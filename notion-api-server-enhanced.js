const Sentry = require('@sentry/node');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { Client } = require('@notionhq/client');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Sentry for error monitoring
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
  console.log('✅ Sentry monitoring initialized');
} else {
  console.log('⚠️  WARNING: SENTRY_DSN not set - error monitoring disabled');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// File upload configuration - use memory storage for Vercel
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
}) : null;

// Email configuration
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Configuration - Notion Database IDs (set these in .env or use auto-discovery)
const CLIENTS_DB = process.env.CLIENTS_DB_ID || process.env.CLIENT_CREDENTIALS_DB_ID;
const CLIENT_DOCUMENTS_DB = process.env.CLIENT_DOCUMENTS_DB_ID;
const CLIENT_ACTIVITIES_DB = process.env.CLIENT_ACTIVITIES_DB_ID || process.env.ACTIVITY_LOG_DB_ID;

// Legacy support
const CLIENT_CREDENTIALS_DB = CLIENTS_DB;
const ACTIVITY_LOG_DB = CLIENT_ACTIVITIES_DB;

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPageTitle(page) {
  const titleProp = Object.values(page.properties).find(prop => prop.type === 'title');
  if (titleProp && titleProp.title && titleProp.title.length > 0) {
    return titleProp.title[0]?.plain_text || 'Untitled';
  }
  return 'Untitled';
}

function getPageEmoji(page) {
  return page.icon?.emoji || '📄';
}

async function findOrCreateDatabase(name, properties) {
  // Search for existing database
  const searchResults = await notion.search({
    query: name,
    filter: { property: 'object', value: 'database' }
  });

  const existing = searchResults.results.find(db => {
    const dbTitle = db.title?.[0]?.plain_text;
    return dbTitle && dbTitle.toLowerCase() === name.toLowerCase();
  });

  if (existing) {
    console.log(`✅ Found existing database: ${name}`);
    return existing.id;
  }

  // Create new database
  console.log(`📝 Creating new database: ${name}`);
  const newDb = await notion.databases.create({
    parent: { type: 'page_id', page_id: process.env.NOTION_PARENT_PAGE_ID || 'workspace' },
    title: [{ type: 'text', text: { content: name } }],
    properties: properties
  });

  return newDb.id;
}

async function logActivity(address, action, details = {}) {
  try {
    if (!ACTIVITY_LOG_DB) return;

    await notion.pages.create({
      parent: { database_id: ACTIVITY_LOG_DB },
      properties: {
        'Client Address': {
          title: [{ text: { content: address } }]
        },
        'Action': {
          rich_text: [{ text: { content: action } }]
        },
        'Details': {
          rich_text: [{ text: { content: JSON.stringify(details) } }]
        },
        'Timestamp': {
          date: { start: new Date().toISOString() }
        }
      }
    });
  } catch (error) {
    console.error('Error logging activity:', error.message);
  }
}

async function sendEmail(to, subject, html) {
  try {
    if (!process.env.EMAIL_USER) {
      console.log('📧 Email not configured - would send:', { to, subject });
      return;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    });

    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error.message);
  }
}

// ============================================
// DATABASE SETUP
// ============================================

async function initializeDatabases() {
  try {
    // Client Credentials Database
    if (!CLIENT_CREDENTIALS_DB) {
      const credentialsDb = await findOrCreateDatabase('Client Credentials', {
        'Address': { title: {} },
        'Email': { email: {} },
        'Password Hash': { rich_text: {} },
        'Access Code': { rich_text: {} },
        'Active': { checkbox: {} },
        'Expiry Date': { date: {} },
        'Last Login': { date: {} },
        'Created Date': { created_time: {} }
      });
      process.env.CLIENT_CREDENTIALS_DB_ID = credentialsDb;
    }

    // Activity Log Database
    if (!ACTIVITY_LOG_DB) {
      const activityDb = await findOrCreateDatabase('Client Activity Log', {
        'Client Address': { title: {} },
        'Action': { rich_text: {} },
        'Details': { rich_text: {} },
        'Timestamp': { date: {} }
      });
      process.env.ACTIVITY_LOG_DB_ID = activityDb;
    }

    console.log('✅ Databases initialized');
  } catch (error) {
    console.error('❌ Error initializing databases:', error.message);
  }
}

// ============================================
// API ROUTES - CLIENT AUTHENTICATION
// ============================================

// Create new client (Admin only)
app.post('/api/admin/clients/create', async (req, res) => {
  try {
    const { address, email, password } = req.body;

    if (!address || !email || !password) {
      return res.status(400).json({ 
        error: 'Address, email, and password are required' 
      });
    }

    // Generate access code and hash password
    const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const passwordHash = await bcrypt.hash(password, 10);

    // Create client in Notion
    const client = await notion.pages.create({
      parent: { database_id: CLIENT_CREDENTIALS_DB },
      properties: {
        'Address': {
          title: [{ text: { content: address } }]
        },
        'Email': {
          email: email
        },
        'Password Hash': {
          rich_text: [{ text: { content: passwordHash } }]
        },
        'Access Code': {
          rich_text: [{ text: { content: accessCode } }]
        },
        'Active': {
          checkbox: true
        }
      }
    });

    // Send welcome email
    await sendEmail(
      email,
      'Your KAA Client Portal Access',
      `
        <h2>Welcome to KAA Client Portal</h2>
        <p>Your account has been created successfully!</p>
        <p><strong>Project Address:</strong> ${address}</p>
        <p><strong>Access Code:</strong> ${accessCode}</p>
        <p><strong>Login URL:</strong> <a href="${process.env.FRONTEND_URL || 'https://kaa-app.vercel.app'}">${process.env.FRONTEND_URL || 'https://kaa-app.vercel.app'}</a></p>
        <p>Click "Client Portal" and enter your address and access code to view your documents.</p>
        <p>If you need assistance, please contact support@kaa.com</p>
      `
    );

    // Log activity
    await logActivity(address, 'Client Created', { email, clientId: client.id });

    res.json({ 
      success: true, 
      client: {
        id: client.id,
        address,
        email,
        accessCode
      }
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Client verification
app.post('/api/client/verify', async (req, res) => {
  try {
    const { address, password } = req.body;

    if (!address || !password) {
      return res.status(400).json({ 
        verified: false, 
        error: 'Address and password are required' 
      });
    }

    // Demo mode
    if (password === 'demo123') {
      await logActivity(address, 'Login (Demo Mode)', { ip: req.ip });
      return res.json({ 
        verified: true, 
        address: address,
        mode: 'demo'
      });
    }

    // Production mode - check credentials database
    if (CLIENT_CREDENTIALS_DB) {
      try {
        const response = await notion.databases.query({
          database_id: CLIENT_CREDENTIALS_DB,
          filter: {
            property: 'Address',
            title: {
              equals: address
            }
          }
        });

        if (response.results.length > 0) {
          const clientPage = response.results[0];
          const props = clientPage.properties;

          // Check if active
          const isActive = props['Active']?.checkbox;
          if (!isActive) {
            return res.json({ 
              verified: false, 
              error: 'Account is inactive. Please contact support.' 
            });
          }

          // Check expiry date
          const expiryDate = props['Expiry Date']?.date?.start;
          if (expiryDate && new Date(expiryDate) < new Date()) {
            return res.json({ 
              verified: false, 
              error: 'Access has expired. Please contact support.' 
            });
          }

          // Verify password
          const passwordHash = props['Password Hash']?.rich_text?.[0]?.plain_text;
          const accessCode = props['Access Code']?.rich_text?.[0]?.plain_text;

          if (passwordHash && await bcrypt.compare(password, passwordHash)) {
            // Update last login
            await notion.pages.update({
              page_id: clientPage.id,
              properties: {
                'Last Login': {
                  date: { start: new Date().toISOString() }
                }
              }
            });

            await logActivity(address, 'Login Success', { ip: req.ip });

            // Send login notification to team
            if (process.env.TEAM_EMAIL) {
              await sendEmail(
                process.env.TEAM_EMAIL,
                `Client Login: ${address}`,
                `<p>Client <strong>${address}</strong> logged in at ${new Date().toLocaleString()}</p>`
              );
            }

            return res.json({ 
              verified: true, 
              address: address,
              email: props['Email']?.email
            });
          } else if (accessCode && accessCode === password) {
            // Allow login with access code
            await notion.pages.update({
              page_id: clientPage.id,
              properties: {
                'Last Login': {
                  date: { start: new Date().toISOString() }
                }
              }
            });

            await logActivity(address, 'Login Success (Access Code)', { ip: req.ip });

            return res.json({ 
              verified: true, 
              address: address,
              email: props['Email']?.email
            });
          }
        }
      } catch (notionError) {
        console.error('Error querying credentials:', notionError);
      }
    }

    // Fallback: search for pages with address
    const searchResponse = await notion.search({
      query: address,
      filter: { property: 'object', value: 'page' }
    });

    if (searchResponse.results.length > 0) {
      await logActivity(address, 'Login (Fallback)', { pageCount: searchResponse.results.length });
      return res.json({ 
        verified: true, 
        address: address,
        mode: 'fallback',
        pageCount: searchResponse.results.length
      });
    }

    // Invalid credentials
    await logActivity(address, 'Login Failed', { ip: req.ip });
    return res.json({ 
      verified: false, 
      error: 'Invalid address or password' 
    });

  } catch (error) {
    console.error('Error verifying client:', error);
    res.status(500).json({ 
      verified: false,
      error: 'Server error during verification' 
    });
  }
});

// User verification endpoint (second step - verify last name)
app.post('/api/client/verify-user', async (req, res) => {
  try {
    const { address, lastName } = req.body;

    if (!address || !lastName) {
      return res.status(400).json({
        verified: false,
        error: 'Address and last name are required'
      });
    }

    // Demo mode - accept any last name for demo accounts
    if (lastName.toLowerCase() === 'demo' || lastName.toLowerCase() === 'test') {
      return res.json({
        verified: true,
        address: address,
        lastName: lastName,
        mode: 'demo'
      });
    }

    // Check clients database for matching last name
    if (CLIENTS_DB) {
      try {
        const response = await notion.databases.query({
          database_id: CLIENTS_DB,
          filter: {
            or: [
              {
                property: 'Project Address',
                rich_text: {
                  equals: address
                }
              },
              {
                property: 'Client Name',
                title: {
                  contains: address
                }
              }
            ]
          }
        });

        if (response.results.length > 0) {
          const clientPage = response.results[0];
          const props = clientPage.properties;

          // Check if last name property exists and matches
          const storedLastName = props['Last Name']?.rich_text?.[0]?.plain_text ||
                                 props['LastName']?.rich_text?.[0]?.plain_text ||
                                 props['Surname']?.rich_text?.[0]?.plain_text;

          if (storedLastName && storedLastName.toLowerCase() === lastName.toLowerCase()) {
            await logActivity(address, 'User Verification Success', {
              lastName,
              ip: req.ip
            });

            return res.json({
              verified: true,
              address: address,
              lastName: lastName,
              clientId: clientPage.id
            });
          } else {
            await logActivity(address, 'User Verification Failed', {
              attemptedLastName: lastName,
              ip: req.ip
            });

            return res.json({
              verified: false,
              error: 'Last name does not match our records'
            });
          }
        }
      } catch (notionError) {
        console.error('Error querying clients database for user verification:', notionError);
      }
    }

    return res.json({
      verified: false,
      error: 'Could not verify user. Please contact support.'
    });

  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({
      verified: false,
      error: 'Server error during verification'
    });
  }
});

// Get client-specific data
app.get('/api/client/data/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({ error: 'Client address is required' });
    }

    // Get client information
    let clientInfo = null;
    if (CLIENTS_DB) {
      try {
        const clientResponse = await notion.databases.query({
          database_id: CLIENTS_DB,
          filter: {
            or: [
              {
                property: 'Project Address',
                rich_text: {
                  equals: address
                }
              },
              {
                property: 'Client Name',
                title: {
                  contains: address
                }
              }
            ]
          }
        });

        if (clientResponse.results.length > 0) {
          const clientPage = clientResponse.results[0];
          const props = clientPage.properties;
          
          clientInfo = {
            id: clientPage.id,
            name: getPageTitle(clientPage),
            address: props['Project Address']?.rich_text?.[0]?.plain_text || address,
            email: props['Email']?.email || '',
            status: props['Status']?.select?.name || 'Active',
            projectType: props['Project Type']?.select?.name || '',
            budgetRange: props['Budget Range']?.select?.name || '',
            projectManager: props['Project Manager']?.people?.[0]?.name || '',
            createdDate: props['Created Date']?.date?.start || '',
            lastLogin: props['Last Login']?.date?.start || ''
          };
        }
      } catch (error) {
        console.error('Error fetching client info:', error);
      }
    }

    // Get client documents
    let documents = [];
    if (CLIENT_DOCUMENTS_DB) {
      try {
        const docsResponse = await notion.databases.query({
          database_id: CLIENT_DOCUMENTS_DB,
          filter: {
            property: 'Client Address',
            relation: {
              contains: clientInfo?.id || ''
            }
          },
          sorts: [
            {
              property: 'Upload Date',
              direction: 'descending'
            }
          ]
        });

        documents = docsResponse.results.map(doc => {
          const props = doc.properties;
          return {
            id: doc.id,
            name: getPageTitle(doc),
            category: props['Category']?.select?.name || 'Document',
            uploadDate: props['Upload Date']?.date?.start || '',
            description: props['Description']?.rich_text?.[0]?.plain_text || '',
            uploadedBy: props['Uploaded By']?.people?.[0]?.name || '',
            status: props['Status']?.select?.name || 'Draft'
          };
        });
      } catch (error) {
        console.error('Error fetching client documents:', error);
      }
    }

    // Get recent activities
    let activities = [];
    if (CLIENT_ACTIVITIES_DB) {
      try {
        const activitiesResponse = await notion.databases.query({
          database_id: CLIENT_ACTIVITIES_DB,
          filter: {
            property: 'Client Address',
            rich_text: {
              equals: address
            }
          },
          sorts: [
            {
              property: 'Timestamp',
              direction: 'descending'
            }
          ]
        });

        activities = activitiesResponse.results.slice(0, 10).map(activity => {
          const props = activity.properties;
          return {
            id: activity.id,
            activity: getPageTitle(activity),
            type: props['Activity Type']?.select?.name || 'General',
            timestamp: props['Timestamp']?.date?.start || '',
            details: props['Details']?.rich_text?.[0]?.plain_text || ''
          };
        });
      } catch (error) {
        console.error('Error fetching client activities:', error);
      }
    }

    res.json({
      client: clientInfo,
      documents: documents,
      activities: activities,
      stats: {
        totalDocuments: documents.length,
        recentUploads: documents.filter(doc => {
          const uploadDate = new Date(doc.uploadDate);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return uploadDate > weekAgo;
        }).length,
        pendingItems: documents.filter(doc => doc.status === 'Review').length
      }
    });

  } catch (error) {
    console.error('Error fetching client data:', error);
    res.status(500).json({ error: 'Server error fetching client data' });
  }
});

// ============================================
// API ROUTES - DOCUMENT UPLOAD
// ============================================

app.post('/api/client/upload', upload.single('file'), async (req, res) => {
  try {
    const { address, category, description } = req.body;
    const file = req.file;

    if (!file || !address) {
      return res.status(400).json({ error: 'File and address are required' });
    }

    // Check if database ID is configured
    const documentsDbId = CLIENT_DOCUMENTS_DB || process.env.NOTION_PARENT_PAGE_ID;
    if (!documentsDbId) {
      console.error('CLIENT_DOCUMENTS_DB_ID or NOTION_PARENT_PAGE_ID not configured');
      return res.status(500).json({ error: 'Server configuration error: Documents database not configured' });
    }

    // Get file content from memory storage
    const fileContent = file.buffer;
    const fileName = file.originalname;

    // Create page in Notion with file reference
    // Note: Notion API doesn't support direct file uploads in the same way
    // We'll create a page with file info and upload link
    const page = await notion.pages.create({
      parent: { 
        database_id: documentsDbId
      },
      properties: {
        'Title': {
          title: [{ text: { content: fileName } }]
        },
        'Client Address': {
          rich_text: [{ text: { content: address } }]
        },
        'Category': {
          select: { name: category || 'Document' }
        },
        'Upload Date': {
          date: { start: new Date().toISOString() }
        },
        'Description': {
          rich_text: [{ text: { content: description || '' } }]
        }
      }
    });

    // Log activity
    await logActivity(address, 'Document Upload', { 
      fileName, 
      fileSize: file.size,
      category,
      pageId: page.id
    });

    // Send notification to team
    if (process.env.TEAM_EMAIL) {
      await sendEmail(
        process.env.TEAM_EMAIL,
        `New Document Upload: ${address}`,
        `
          <p>Client <strong>${address}</strong> uploaded a document:</p>
          <ul>
            <li><strong>File:</strong> ${fileName}</li>
            <li><strong>Size:</strong> ${(file.size / 1024).toFixed(2)} KB</li>
            <li><strong>Category:</strong> ${category || 'Document'}</li>
          </ul>
          <p><a href="${page.url}">View in Notion</a></p>
        `
      );
    }

    // Note: Using memory storage, no file cleanup needed
    // File is in memory buffer, not on disk

    res.json({ 
      success: true, 
      page: {
        id: page.id,
        url: page.url,
        fileName
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    // Using memory storage, no file cleanup needed
    const errorMessage = error.message || 'Failed to upload document';
    res.status(500).json({ error: errorMessage });
  }
});

// ============================================
// EXISTING API ROUTES (from original server)
// ============================================

// Get all pages
app.get('/api/notion/pages', async (req, res) => {
  try {
    if (!process.env.NOTION_API_KEY) {
      return res.status(500).json({ 
        error: 'Notion API key not configured' 
      });
    }

    const response = await notion.search({
      query: '',
      filter: { property: 'object', value: 'page' }
    });

    const databaseCache = new Map();
    const teamspaceCache = new Map();
    
    const pages = await Promise.all(response.results.map(async (page) => {
      let databaseName = null;
      let teamspaceName = null;
      
      const dbId = page.parent?.database_id || page.parent?.data_source_id;
      if ((page.parent?.type === 'database_id' || page.parent?.type === 'data_source_id') && dbId) {
        if (!databaseCache.has(dbId)) {
          try {
            const database = await notion.databases.retrieve({ database_id: dbId });
            const dbTitle = database.title?.[0]?.plain_text || 'Untitled Database';
            
            let teamspace = 'Private Workspace';
            if (database.parent?.type === 'page_id') {
              const teamspaceId = database.parent.page_id;
              if (!teamspaceCache.has(teamspaceId)) {
                try {
                  const teamspacePage = await notion.pages.retrieve({ page_id: teamspaceId });
                  const teamspaceTitle = getPageTitle(teamspacePage);
                  teamspaceCache.set(teamspaceId, teamspaceTitle);
                } catch (err) {
                  teamspaceCache.set(teamspaceId, 'Unknown Space');
                }
              }
              teamspace = teamspaceCache.get(teamspaceId);
            }
            
            databaseCache.set(dbId, { name: dbTitle, teamspace: teamspace });
          } catch (err) {
            databaseCache.set(dbId, { name: null, teamspace: null });
          }
        }
        
        const dbInfo = databaseCache.get(dbId);
        databaseName = dbInfo?.name;
        teamspaceName = dbInfo?.teamspace;
      }

      return {
        id: page.id,
        title: getPageTitle(page),
        emoji: getPageEmoji(page),
        last_edited_time: page.last_edited_time,
        created_time: page.created_time,
        url: page.url,
        properties: page.properties,
        parent: page.parent,
        databaseName,
        teamspaceName,
        parentType: page.parent?.type,
        parentId: page.parent?.page_id || page.parent?.database_id || page.parent?.data_source_id
      };
    }));

    res.json(pages);
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({ error: 'Failed to fetch pages from Notion' });
  }
});

// Get page content
app.get('/api/notion/pages/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params;
    
    const [page, blocks] = await Promise.all([
      notion.pages.retrieve({ page_id: pageId }),
      notion.blocks.children.list({ block_id: pageId })
    ]);

    res.json({
      page: {
        ...page,
        title: getPageTitle(page),
        emoji: getPageEmoji(page)
      },
      blocks: blocks.results
    });
  } catch (error) {
    console.error('Error fetching page content:', error);
    res.status(500).json({ error: 'Failed to fetch page content' });
  }
});

// Get all databases
app.get('/api/notion/databases', async (req, res) => {
  try {
    const response = await notion.search({
      filter: { property: 'object', value: 'database' }
    });

    const databases = response.results.map(db => ({
      id: db.id,
      title: db.title?.[0]?.plain_text || 'Untitled',
      description: db.description?.[0]?.plain_text || '',
      url: db.url,
      properties: db.properties,
      created_time: db.created_time,
      last_edited_time: db.last_edited_time
    }));

    res.json(databases);
  } catch (error) {
    console.error('Error fetching databases:', error);
    res.status(500).json({ error: 'Failed to fetch databases' });
  }
});

// ============================================
// SAGE CHATGPT API ENDPOINT
// ============================================

app.post('/api/sage/chat', async (req, res) => {
  try {
    // Check if OpenAI is configured
    if (!openai) {
      return res.status(500).json({ 
        error: 'OpenAI API not configured. Please set OPENAI_API_KEY in your .env file.' 
      });
    }

    const { 
      message, 
      conversationHistory = [], 
      clientAddress = '',
      mode = 'client',
      currentView = 'hub',
      onboardingActive = false,
      onboardingStep = 0,
      isAskingAboutSupport = false
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build system prompt for Sage personality
    let systemPrompt = `You are Sage, a friendly and helpful AI assistant for the SAGE Garden Wizard platform (a landscape architecture client portal). 

Your personality:
- Warm, welcoming, and professional
- Use emojis sparingly but naturally (🧙‍♀️ for yourself)
- Be concise but thorough
- Helpful and proactive
- Knowledgeable about landscape architecture projects

Context:
- User: ${clientAddress || 'Client'}
- Mode: ${mode === 'client' ? 'Client Portal' : 'Team Dashboard'}
- Current View: ${currentView}
- Onboarding: ${onboardingActive ? `Active (Step ${onboardingStep})` : 'Not active'}

Available features in the Client Portal:
- 📄 Documents: View and manage project documents
- 💬 Messages: Contact project manager
- 📤 Upload: Share files with team
- 📊 Analytics: View project progress and insights
- 🔔 Notifications: Stay updated on project activity
- 📁 Projects: View project plans and deliverables

${mode === 'client' ? `
Client Portal Features:
- Dashboard with project overview
- Document management
- Messaging system
- File uploads
- Project progress tracking
- Analytics dashboard
` : `
Team Dashboard Features:
- Project management
- Deliverable tracking
- Client communications
- Task prioritization
`}

Guidelines:
- If user asks about onboarding, guide them through it naturally
- If user asks about features, explain clearly how to access them
- If user asks about their project, provide helpful context
- If user asks about support agents, pricing tiers, or service levels, explain the SAGE tier system (Tiers 1-3) and KAA white glove (Tier 4)
- Keep responses conversational and helpful
- If you don't know something specific, suggest they contact their project manager
- Always be encouraging and supportive

${isAskingAboutSupport ? `
IMPORTANT: The user is asking about support agents or pricing. Include detailed information about:
- Tier 1 (The Concept): Fully automated, no-touch, fixed pricing
- Tier 2 (The Builder): Low-touch with designer checkpoints, fixed pricing
- Tier 3 (The Concierge): Includes site visits, hybrid approach, fixed + site visit fee
- Tier 4 (KAA White Glove): Premium service, we choose clients, percentage of install pricing
` : ''}`;

    // Build conversation messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using gpt-4o-mini for cost efficiency, can upgrade to gpt-4o if needed
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
      frequency_penalty: 0.3,
      presence_penalty: 0.3
    });

    const response = completion.choices[0]?.message?.content || 'I apologize, but I encountered an error. Please try again.';

    res.json({ 
      response,
      usage: completion.usage
    });

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    
    // Handle specific OpenAI errors
    if (error.response) {
      return res.status(error.response.status || 500).json({ 
        error: error.response.data?.error?.message || 'OpenAI API error',
        details: error.response.data
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get response from Sage',
      details: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    notion_configured: !!process.env.NOTION_API_KEY,
    email_configured: !!process.env.EMAIL_USER,
    openai_configured: !!process.env.OPENAI_API_KEY,
    sentry_configured: !!process.env.SENTRY_DSN,
    databases_configured: !!(CLIENT_CREDENTIALS_DB && ACTIVITY_LOG_DB),
    timestamp: new Date().toISOString()
  });
});

// ============================================
// DESIGN IDEAS API ROUTES
// ============================================

// In-memory storage for design ideas (in production, use database)
const designIdeasStore = new Map();

// Get all design ideas for a client
app.get('/api/client/design-ideas/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const decodedAddress = decodeURIComponent(address);
    
    // Get all design ideas for this client
    const clientIdeas = Array.from(designIdeasStore.values())
      .filter(idea => idea.clientAddress === decodedAddress)
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    
    res.json({ designIdeas: clientIdeas });
  } catch (error) {
    console.error('Error fetching design ideas:', error);
    res.status(500).json({ error: 'Failed to fetch design ideas' });
  }
});

// Upload design idea image
app.post('/api/client/design-ideas/upload', upload.single('file'), async (req, res) => {
  try {
    const { address, title, description, tags } = req.body;
    const file = req.file;

    if (!file || !address) {
      return res.status(400).json({ error: 'File and address are required' });
    }

    // For now, we'll use a placeholder URL since we can't store files directly
    // In production, upload to Supabase Storage or S3
    const imageUrl = `https://via.placeholder.com/400x600?text=${encodeURIComponent(title || 'Design Idea')}`;
    
    const designIdea = {
      id: `di-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      imageUrl,
      title: title?.trim() || '',
      description: description?.trim() || '',
      source: 'upload',
      tags: tags ? JSON.parse(tags) : [],
      addedAt: new Date().toISOString(),
      clientAddress: address
    };

    designIdeasStore.set(designIdea.id, designIdea);

    res.json({ designIdea });
  } catch (error) {
    console.error('Error uploading design idea:', error);
    res.status(500).json({ error: 'Failed to upload design idea' });
  }
});

// Add design idea from URL
app.post('/api/client/design-ideas/add', async (req, res) => {
  try {
    const { address, imageUrl, title, description, tags, source } = req.body;

    if (!imageUrl || !address) {
      return res.status(400).json({ error: 'Image URL and address are required' });
    }

    const designIdea = {
      id: `di-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      imageUrl: imageUrl.trim(),
      title: title?.trim() || '',
      description: description?.trim() || '',
      source: source || 'url',
      tags: tags || [],
      addedAt: new Date().toISOString(),
      clientAddress: address
    };

    designIdeasStore.set(designIdea.id, designIdea);

    res.json({ designIdea });
  } catch (error) {
    console.error('Error adding design idea:', error);
    res.status(500).json({ error: 'Failed to add design idea' });
  }
});

// Import from Pinterest
app.post('/api/client/design-ideas/pinterest-import', async (req, res) => {
  try {
    const { address, boardUrl } = req.body;

    if (!boardUrl || !address) {
      return res.status(400).json({ error: 'Board URL and address are required' });
    }

    // TODO: Integrate with Pinterest API
    // For now, return demo data
    // In production, use Pinterest API to fetch board pins
    // You'll need: PINTEREST_APP_ID and PINTEREST_APP_SECRET in .env
    
    const demoIdeas = [
      {
        id: `di-${Date.now()}-1`,
        imageUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
        title: 'Modern Garden Design',
        description: 'Imported from Pinterest',
        source: 'pinterest',
        pinterestUrl: boardUrl,
        tags: ['Modern', 'Garden'],
        addedAt: new Date().toISOString(),
        clientAddress: address
      },
      {
        id: `di-${Date.now()}-2`,
        imageUrl: 'https://images.unsplash.com/photo-1464822759844-d150ad2996e3?w=400',
        title: 'Outdoor Living Space',
        description: 'Imported from Pinterest',
        source: 'pinterest',
        pinterestUrl: boardUrl,
        tags: ['Outdoor Living', 'Hardscape'],
        addedAt: new Date().toISOString(),
        clientAddress: address
      }
    ];

    demoIdeas.forEach(idea => {
      designIdeasStore.set(idea.id, idea);
    });

    res.json({ 
      designIdeas: demoIdeas,
      message: 'Pinterest import feature coming soon. For now, showing demo data.'
    });
  } catch (error) {
    console.error('Error importing from Pinterest:', error);
    res.status(500).json({ error: 'Failed to import from Pinterest' });
  }
});

// Delete design idea
app.delete('/api/client/design-ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.body;

    const idea = designIdeasStore.get(id);
    
    if (!idea) {
      return res.status(404).json({ error: 'Design idea not found' });
    }

    if (idea.clientAddress !== address) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    designIdeasStore.delete(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting design idea:', error);
    res.status(500).json({ error: 'Failed to delete design idea' });
  }
});

// ============================================
// SENTRY ERROR HANDLER (must be after routes)
// ============================================

// Sentry error handler middleware - captures errors and sends to Sentry
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, async () => {
  console.log(`🚀 KAA Enhanced API Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  
  if (!process.env.NOTION_API_KEY) {
    console.log('⚠️  WARNING: NOTION_API_KEY not set');
  } else {
    console.log('✅ Notion API key configured');
  }
  
  if (!process.env.EMAIL_USER) {
    console.log('⚠️  WARNING: Email not configured (EMAIL_USER, EMAIL_PASSWORD)');
  } else {
    console.log('✅ Email configured');
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  WARNING: OpenAI API key not set - Sage ChatGPT features will not work');
    console.log('   Set OPENAI_API_KEY in your .env file to enable intelligent Sage conversations');
  } else {
    console.log('✅ OpenAI API configured - Sage ChatGPT enabled');
  }

  // Initialize databases
  await initializeDatabases();
});

module.exports = app;

