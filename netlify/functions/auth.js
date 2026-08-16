const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { seat, pin } = body;

    if (!seat || !pin) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Please enter seat number and PIN." }) };
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = process.env.SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      throw new Error("Missing Google credentials in Netlify Environment Variables.");
    }

    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    await doc.loadInfo();

    // Access the 'Users' tab
    const sheet = doc.sheetsByTitle['Users'];
    if (!sheet) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: "Database tab 'Users' not found." }) };
    }

    const rows = await sheet.getRows();
    
    // Check if the entered seat and PIN match any row in the spreadsheet
    const matchedRow = rows.find(r => 
      String(r.get('Seat')).trim() === String(seat).trim() && 
      String(r.get('PIN')).trim() === String(pin).trim()
    );

    if (matchedRow) {
      const studentName = matchedRow.get('Student_Name') || 'Student';
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, studentName })
      };
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, message: "Invalid Seat Number or PIN. Access Denied." })
      };
    }

  } catch (error) {
    console.error("Auth Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: error.message || "Internal Server Error" })
    };
  }
};
