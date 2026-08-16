const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // We now pull 'seat' and 'pin' from your frontend request
        // (Adding a fallback to 'phone' just in case your frontend fetch still uses the word phone)
        const data = JSON.parse(event.body);
        const seatNumber = data.seat || data.phone; 
        const pin = data.pin;

        // Connect to Google securely using Netlify Environment Variables
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo(); 

        // Target the tab named 'Users'
        const sheet = doc.sheetsByTitle['Users']; 
        
        // If the tab doesn't exist, throw a clear error
        if (!sheet) {
            throw new Error("Could not find a tab named 'Users'");
        }

        const rows = await sheet.getRows();

        // Bulletproof search: Looks specifically for the 'Seat' column in your Google Sheet
        const user = rows.find(row => 
            String(row.get('Seat')).trim() === String(seatNumber).trim() && 
            String(row.get('PIN')).trim() === String(pin).trim()
        );

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
        console.error("Auth Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
