const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // 1. Flexible environment variable lookup to prevent undefined errors
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = process.env.SPREADSHEET_ID;

    let missing = [];
    if (!clientEmail) missing.push('GOOGLE_CLIENT_EMAIL (or GOOGLE_SERVICE_ACCOUNT_EMAIL)');
    if (!privateKey) missing.push('GOOGLE_PRIVATE_KEY');
    if (!spreadsheetId) missing.push('SPREADSHEET_ID');

    if (missing.length > 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Configuration Error", 
          details: `Missing Netlify Environment Variables: ${missing.join(', ')}. Go to Netlify > Site settings > Environment variables and add them.` 
        })
      };
    }

    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    await doc.loadInfo(); 

    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    if (method === 'GET') {
      const targetSheet = event.queryStringParameters.sheet;
      if (!targetSheet) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing sheet parameter" }) };

      const sheet = doc.sheetsByTitle[targetSheet];
      if (!sheet) return { statusCode: 404, headers, body: JSON.stringify({ error: `Sheet tab '${targetSheet}' not found.` }) };

      const rows = await sheet.getRows();
      const data = rows.map(row => {
        let rowData = {};
        sheet.headerValues.forEach(header => {
            rowData[header] = row.get(header);
        });
        return rowData;
      });

      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (method === 'POST') {
      const { sheetName, action, rowData, rowId } = body;
      const sheet = doc.sheetsByTitle[sheetName];

      if (!sheet) return { statusCode: 404, headers, body: JSON.stringify({ error: `Sheet tab '${sheetName}' not found.` }) };

      if (action === 'ADD') {
        await sheet.addRow(rowData);
        return { statusCode: 200, headers, body: JSON.stringify({ message: "Row added successfully!" }) };
      }
      
      if (action === 'DELETE') {
        const rows = await sheet.getRows();
        const rowToDelete = rows.find(r => String(r.get('ID')) === String(rowId));
        if (rowToDelete) {
            await rowToDelete.delete();
            return { statusCode: 200, headers, body: JSON.stringify({ message: "Row deleted." }) };
        }
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Row ID not found." }) };
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };

  } catch (error) {
    console.error("Detailed Server Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Google API Error", details: error.message || error.toString() })
    };
  }
};
