const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { studentName, task, status } = JSON.parse(event.body);

        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo(); 
        const sheet = doc.sheetsByTitle['Progress'];

        const rows = await sheet.getRows();
        // Look for an existing row for this student and task
        const existingRow = rows.find(r => r.get('Student_Name') === studentName && r.get('Task') === task);

        if (existingRow) {
            existingRow.set('Status', status);
            await existingRow.save();
        } else {
            await sheet.addRow({ Student_Name: studentName, Task: task, Status: status });
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
