const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const data = JSON.parse(event.body);
        const inputSeat = data.seat;
        const inputPin = data.pin;

        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo(); 

        const sheet = doc.sheetsByTitle['Users']; 
        if (!sheet) throw new Error("Could not find 'Users' tab");

        const rows = await sheet.getRows();

        // Find the exact match
        const user = rows.find(row => {
            const rowSeat = row.get('Seat');
            const rowPin = row.get('PIN');
            
            // Skip empty rows
            if (!rowSeat || !rowPin) return false;

            return String(rowSeat).trim() === String(inputSeat).trim() && 
                   String(rowPin).trim() === String(inputPin).trim();
        });

        if (user) {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, studentName: user.get('Student_Name') })
            };
        } else {
            return {
                statusCode: 401,
                body: JSON.stringify({ success: false, message: "Invalid credentials" })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
