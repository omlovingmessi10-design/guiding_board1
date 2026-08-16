exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Preflight request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { seat, pin } = body;

    // Pull the secret credentials from Netlify Environment Variables
    // (Defaults to UPSC2026 and 1234 if you haven't set them yet)
    const validSeat = process.env.STUDENT_SEAT || 'UPSC2026';
    const validPin = process.env.STUDENT_PIN || '1234';

    if (seat === validSeat && pin === validPin) {
      return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ success: true, studentName: "Admin" }) 
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
        body: JSON.stringify({ success: false, message: "Internal Server Error" }) 
    };
  }
};
