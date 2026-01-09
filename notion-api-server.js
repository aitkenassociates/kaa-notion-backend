const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// Production-safe logger - only logs debug messages in development
const isDevelopment = process.env.NODE_ENV !== 'production';
const logger = {
  debug: (...args) => { if (isDevelopment) console.log(...args); },
  info: (...args) => { if (isDevelopment) console.log(...args); },
  error: (...args) => console.error(...args), // Always log errors
  startup: (...args) => console.log(...args)  // Always log startup info
};
const PORT = process.env.PORT || 3001;

// Middleware - CORS configuration for Vercel deployments
// Allow all origins for now (can restrict later in production)
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// File upload configuration
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Email configuration
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Configuration - Notion Database IDs (set these in .env or use auto-discovery)
const CLIENT_CREDENTIALS_DB = process.env.CLIENT_CREDENTIALS_DB_ID;
const CLIENT_DOCUMENTS_DB = process.env.CLIENT_DOCUMENTS_DB_ID;
const ACTIVITY_LOG_DB = process.env.ACTIVITY_LOG_DB_ID;

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
    logger.debug(`✅ Found existing database: ${name}`);
    return existing.id;
  }

  // Create new database
  logger.debug(`📝 Creating new database: ${name}`);
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
    logger.error('Error logging activity:', error.message);
  }
}

async function sendEmail(to, subject, html) {
  try {
    if (!process.env.EMAIL_USER) {
      logger.debug('📧 Email not configured - would send:', { to, subject });
      return;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    });

    logger.debug(`✅ Email sent to ${to}`);
  } catch (error) {
    logger.error('Error sending email:', error.message);
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

    logger.debug('✅ Databases initialized');
  } catch (error) {
    logger.error('❌ Error initializing databases:', error.message);
  }
}

// ============================================
// API ROUTES - CLIENT AUTHENTICATION
// ============================================

// Create new client (Admin only)
app.post('/api/admin/clients/create', async (req, res) => {
  try {
    const { address, email, password, lastName } = req.body;

    if (!address || !email || !password || !lastName) {
      return res.status(400).json({ 
        error: 'Address, email, password, and last name are required' 
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
        'Last Name': {
          rich_text: [{ text: { content: lastName } }]
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
    logger.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
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
    // (These would be accounts that used "demo123" as password)
    if (lastName.toLowerCase() === 'demo' || lastName.toLowerCase() === 'test') {
      return res.json({ 
        verified: true, 
        address: address,
        lastName: lastName,
        mode: 'demo'
      });
    }

    // Check credentials database for matching last name
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
              lastName: lastName
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
        logger.error('Error querying credentials for user verification:', notionError);
      }
    }

    // If no database or not found, return error
    return res.json({
      verified: false,
      error: 'Could not verify user. Please contact support.'
    });

  } catch (error) {
    logger.error('Error verifying user:', error);
    res.status(500).json({ 
      verified: false,
      error: 'Server error during verification' 
    });
  }
});

// Client verification (first step - password/access code)
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
        logger.error('Error querying credentials:', notionError);
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
    logger.error('Error verifying client:', error);
    res.status(500).json({
      verified: false,
      error: 'Server error during verification'
    });
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

    // Read file content
    const fileContent = fs.readFileSync(file.path);
    const fileName = file.originalname;

    // Create page in Notion with file reference
    // Note: Notion API doesn't support direct file uploads in the same way
    // We'll create a page with file info and upload link
    const page = await notion.pages.create({
      parent: { 
        database_id: CLIENT_DOCUMENTS_DB || process.env.NOTION_PARENT_PAGE_ID 
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

    // Clean up temp file
    fs.unlinkSync(file.path);

    res.json({ 
      success: true, 
      page: {
        id: page.id,
        url: page.url,
        fileName
      }
    });
  } catch (error) {
    logger.error('Error uploading document:', error);
    // Clean up on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        logger.error('Error cleaning up file:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Failed to upload document' });
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
    logger.error('Error fetching pages:', error);
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
    logger.error('Error fetching page content:', error);
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
    logger.error('Error fetching databases:', error);
    res.status(500).json({ error: 'Failed to fetch databases' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    notion_configured: !!process.env.NOTION_API_KEY,
    email_configured: !!process.env.EMAIL_USER,
    databases_configured: !!(CLIENT_CREDENTIALS_DB && ACTIVITY_LOG_DB),
    timestamp: new Date().toISOString()
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, async () => {
  logger.startup(`🚀 KAA Enhanced API Server running on http://localhost:${PORT}`);
  logger.startup(`📋 Health check: http://localhost:${PORT}/api/health`);

  if (!process.env.NOTION_API_KEY) {
    logger.startup('⚠️  WARNING: NOTION_API_KEY not set');
  } else {
    logger.startup('✅ Notion API key configured');
  }

  if (!process.env.EMAIL_USER) {
    logger.startup('⚠️  WARNING: Email not configured (EMAIL_USER, EMAIL_PASSWORD)');
  } else {
    logger.startup('✅ Email configured');
  }

  // Initialize databases
  await initializeDatabases();
});

module.exports = app;

