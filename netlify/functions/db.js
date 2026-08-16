const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// 1. Initialize the Google Auth JWT using your existing Netlify Environment Variables
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

exports.handler = async (event, context) => {
  // CORS Headers to allow your frontend to talk to this function securely
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // 2. Connect to the Prayas_DB Sheet
    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo(); 

    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    // --- GET DATA (Read from Sheet) ---
    if (method === 'GET') {
      const targetSheet = event.queryStringParameters.sheet;
      if (!targetSheet) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing sheet parameter" }) };

      const sheet = doc.sheetsByTitle[targetSheet];
      if (!sheet) return { statusCode: 404, headers, body: JSON.stringify({ error: "Sheet not found" }) };

      const rows = await sheet.getRows();
      // Extract headers dynamically to build the JSON response
      const data = rows.map(row => {
        let rowData = {};
        sheet.headerValues.forEach(header => {
            rowData[header] = row.get(header);
        });
        return rowData;
      });

      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // --- POST DATA (Write to Sheet) ---
    if (method === 'POST') {
      const { sheetName, action, rowData, rowId } = body;
      const sheet = doc.sheetsByTitle[sheetName];

      if (!sheet) return { statusCode: 404, headers, body: JSON.stringify({ error: "Sheet not found" }) };

      if (action === 'ADD') {
        await sheet.addRow(rowData);
        return { statusCode: 200, headers, body: JSON.stringify({ message: "Row added successfully!" }) };
      }
      
      if (action === 'DELETE') {
        const rows = await sheet.getRows();
        const rowToDelete = rows.find(r => r.get('ID') === String(rowId));
        if (rowToDelete) {
            await rowToDelete.delete();
            return { statusCode: 200, headers, body: JSON.stringify({ message: "Row deleted." }) };
        }
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Row ID not found." }) };
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };

  } catch (error) {
    console.error("Database Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server Error", details: error.message })
    };
  }
};
