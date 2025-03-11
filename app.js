import express from "express";
import cookieParser from "cookie-parser"; 
import path from "path";
import { fileURLToPath } from 'url';
import bodyParser from "body-parser";  
import pg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const saltRounds = 10;
const port = 3000;
app.use(cookieParser());
const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});



function calculatePostedTime(createdAt) {
    const now = new Date();
    const createdDate = new Date(createdAt);
    const diffInSeconds = Math.floor((now - createdDate) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}


db.connect();

//middleweeerrrrr
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).redirect("/login");
    }

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) {
            return res.status(403).send("Invalid token");
        }

        try {
            const email = user.email;

            const result = await db.query(
                `SELECT user_id,email, farmer_profile_completed, buyer_profile_completed 
                 FROM users WHERE email = $1`, 
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(404).send("User not found");
            }

            const dbUser = result.rows[0];

            let profileStatusStr ="";
            if(dbUser.farmer_profile_completed) profileStatusStr+='farmer';
            if(dbUser.buyer_profile_completed) profileStatusStr+='buyer';
            if(!dbUser.farmer_profile_completed && !dbUser.buyer_profile_completed) profileStatusStr='incomplete';
            req.user = {
                ...dbUser,
                profileStatus:profileStatusStr
            };

            next();
        } catch (dbError) {
            console.error("Database error:", dbError);
            return res.status(500).send("Internal Server Error");
        }
    });
};

function formatProposals(proposals) {
    const lowerLimit = Math.floor(proposals / 5) * 5;
    const upperLimit = lowerLimit + 5;
    return `${lowerLimit} to ${upperLimit}`;
}

app.set('view engine', 'ejs');

// routessss 
app.get("/", (req, res) => {
    res.render("landing.ejs");
});
app.get("/login", (req, res) => {
    res.render("login.ejs", {errorMessage : null});
});
app.get("/register", (req, res) => {
    res.render("register.ejs", {errorMessage : null});
});
app.get("/about", (req, res) => {
    res.render("about.ejs", {errorMessage : null});
});
 // Import database connection

app.get("/profile", authenticateToken, async (req, res) => {
    try {
        // Fetch the farmer profile
        const user_id = req.user.user_id;
        const userData = await db.query(
            "SELECT * FROM users WHERE user_id = $1",[user_id]
        );


        // Prepare the data for EJS rendering
        
        
        // Render profile page
        console.log(userData.rows[0]);
        res.render("profile", { profileData: userData.rows[0] });
    } catch (err) {
        console.error("Error fetching user profiles:", err);
        res.status(500).send("Server Error");
    }
});


app.get("/postdemandpage", authenticateToken, (req, res) => {
    try {
        res.render("postdemand.ejs", { user: req.user }); // Pass user data to EJS
    } catch (err) {
        console.error("Error rendering post demand page:", err);
        res.status(500).send("Server Error");
    }
});




app.post("/postdemand", authenticateToken, async (req, res) => {
    try {
        const {
            crop_name,
            quantity,
            price_offered,
            delivery_deadline,
            description,
            spendingcategory,
            location,
        } = req.body;

        // Extract timeline stage data dynamically
        let node_titles = [];
        let node_dates = [];
        let node_descriptions = [];

        // Loop through the request body to find stage inputs dynamically
        for (let i = 1; i <= 4; i++) { // Assuming max 4 stages from your form
            if (req.body[`node_title${i}`] && req.body[`node_date${i}`] && req.body[`node_description${i}`]) {
                node_titles.push(req.body[`node_title${i}`]);
                node_dates.push(req.body[`node_date${i}`]);
                node_descriptions.push(req.body[`node_description${i}`]);
            }
        }

        // Insert into requests table
        const requestQuery = `
            INSERT INTO requests (crop_name, quantity, offer_price, delivery_deadline, description, spending_category, location, total_amount, user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING request_id;
        `;

        const requestValues = [
            crop_name,
            quantity,
            price_offered,
            delivery_deadline,
            description,
            spendingcategory,
            location,
            price_offered * quantity,
            req.user.user_id
        ];

        const requestResult = await db.query(requestQuery, requestValues);
        const requestId = requestResult.rows[0].request_id; // Get inserted request ID

        // Insert into demand_timeline table
        const timelineQuery = `
            INSERT INTO demand_timeline (request_id, stage_title, stage_date, stage_description)
            VALUES ($1, $2, $3, $4);
        `;

        for (let i = 0; i < node_titles.length; i++) {
            await db.query(timelineQuery, [requestId, node_titles[i], node_dates[i], node_descriptions[i]]);
        }

        res.redirect("home");
    } catch (error) {
        console.error("Error posting demand:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/timeline/:request_id", authenticateToken, async (req, res) => {
    try {
        const requestId = req.params.request_id;

        const query = `
            SELECT stage_title, stage_date, stage_description
            FROM demand_timeline
            WHERE request_id = $1
            ORDER BY stage_date ASC;
        `;

        const result = await db.query(query, [requestId]);

        const formattedResult = result.rows.map(item => ({
            ...item,
            stage_date: new Date(item.stage_date).toISOString().split('T')[0]
        }));

        res.json(formattedResult);
    } catch (error) {
        console.error("Error fetching timeline:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



app.post("/reguser", async (req, res) => {
    console.log("Received registration request"); 
    console.log("Request Body:", req.body);
    const { fname, lname, username: email, password } = req.body;

    try {
        const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (checkResult.rows.length > 0) {
            
            return res.render('register.ejs', { errorMessage : 'user already exists'});
        }

        bcrypt.hash(password, saltRounds, async (err, hash) => {
            if (err) {
                console.error("Error hashing password:", err);
                return res.status(500).send("Server error. Please try again.");
            }

            console.log("Hashed Password:", hash);

            await db.query(
                "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
                [fname+" "+lname, email, hash]
            );

            res.redirect("login"); 
        });

    } catch (err) {
        console.error("Database error:", err);
        res.status(500).send("Server error. Please try again.");
    }
});

app.post("/login", async (req, res) => {
    const email = req.body.username;
    const loginPassword = req.body.password;

    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (result.rows.length === 0) {
            return res.render('login', { errorMessage: "User not found" });
        }

        const user = result.rows[0];
        const storedHashedPassword = user.password;
        const isMatch = await bcrypt.compare(loginPassword, storedHashedPassword);

        if (!isMatch) {
            return res.render('login', {errorMessage : 'incorrect login or password'});
        }

        const accessToken = jwt.sign(
            { email: user.email, id: user.id },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.cookie("token", accessToken, {
            httpOnly: true,   // Prevent client-side JS access
            secure: false,    // Set `true` if using HTTPS
            maxAge: 3600000   // Expire in 1 hour
        });

        res.redirect('home');

    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ error: "Server error" });
    }
});
  
app.get("/home", authenticateToken, async (req, res) => {
    try {
        console.log(req.user);
        const filterMyDemands = req.query.filter === 'myDemands';

        const [result, userResult] = await Promise.all([
            db.query('SELECT * FROM requests ORDER BY created_at DESC;'),
            db.query('SELECT * FROM users WHERE email = $1', [req.user.email])
        ]);

        const userData = userResult.rows[0];

        let filteredRequests = result.rows.map(row => ({
            ...row,
            delivery_deadline: row.delivery_deadline.toISOString().split('T')[0],
            proposals: formatProposals(row.proposals),
            posted_time: calculatePostedTime(row.created_at)
        }));


        if (filterMyDemands) {
            filteredRequests = filteredRequests.filter(request =>
                request.user_id === userData.user_id || request.accepted_by === userData.email
            ).map(request => ({
                ...request,
                accepted_status: request.accepted_by 
                    ? `Accepted by - ${request.accepted_by}` 
                    : 'Yet to be accepted'
            }));
        } else {
            filteredRequests = filteredRequests
                .filter(request => request.accepted_by === null)
                .filter(request => request.user_id != userData.user_id);
        }

        res.render('home', { 
            requests: filteredRequests,
            profileStatus: req.user.profileStatus,
            user: userData
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Server Error');
    }
});


app.get('/home/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

app.get('/home/search', authenticateToken, (req, res) => {
    const searchQuery = req.query.query || '';
    res.redirect(`/home?searchQuery=${encodeURIComponent(searchQuery)}`);
});

app.post('/submit-farmer-profile',authenticateToken, (req, res) => {
    const { location, farmSize, cropsGrown, experience, farmingMethods } = req.body;
    const farmerProfile = {
        location,
        farmSize: parseFloat(farmSize),
        cropsGrown: cropsGrown.split(',').map(crop => crop.trim()),
        experience: parseInt(experience),
        farmingMethods: farmingMethods.split(',').map(method => method.trim()),
        past_deals:0,
        rating:0,
        profileComplete: true
    };

    const query = `
        UPDATE users 
        SET farmer_profile = $1, farmer_profile_completed = $2 
        WHERE email = $3
    `;

    db.query(query, [farmerProfile, true, req.user.email])
        .then(() => res.status(200).redirect('home'))
        .catch(err => res.status(500).json({ error: 'Failed to update profile', details: err.message }));

})

app.post('/submit-buyer-profile', authenticateToken, async (req, res) => {
    
    const { location, companyName, productsNeeded, preferredQuantities } = req.body;

    const buyerProfile = {
        location,
        companyName,
        productsNeeded: productsNeeded.split(',').map(product => product.trim()),
        preferredQuantities,
        paymentReliability: 1.0,
        past_deals: 0,
        rating: 0,
    };

    try {
        await db.query(

            'UPDATE users SET buyer_profile = $1, buyer_profile_completed = $3 WHERE email = $2',
            [buyerProfile, req.user.email ,true]
        );
        res.status(200).redirect('home');
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to submit buyer profile' });
    }
});

app.get('/home/request', async (req, res) => {
    const { request_id } = req.query;
    try {
        const result = await db.query(`
            SELECT 
                requests.*, 
                users.name, 
                users.buyer_profile 
            FROM requests 
            JOIN users 
            ON users.user_id = requests.user_id 
            WHERE requests.request_id = $1
        `, [request_id]);
        
        if (result.rows.length > 0) {
            const buyerProfile = result.rows[0].buyer_profile || {};
            const requestData = {
                ...result.rows[0],
                buyer_name: result.rows[0].name,
                buyer_location: buyerProfile.location,
                buyer_company: buyerProfile.companyName
            };
            res.json(requestData);
        } else {
            res.status(404).json({ error: 'Request not found' });
        }
        
        
    } catch (error) {
        console.error('Error fetching request details:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/get-farmer-profile', async (req, res) => {
    const { user_id } = req.query;

    try {
        const result = await db.query(`
            SELECT farmer_profile, farmer_profile_completed 
            FROM users 
            WHERE user_id = $1
        `, [user_id]);

        if (result.rows.length > 0) {
            const { farmer_profile, farmer_profile_completed } = result.rows[0];
            res.json({ farmer_profile, farmer_profile_completed });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching farmer profile:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/get-buyer-profile', authenticateToken, async (req, res) => {
    try {
        const userData = await db.query('SELECT * FROM users WHERE user_id = $1', [req.query.user_id]);
        if (!userData.rows.length) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userData.rows[0];
        const buyerProfile = user.buyer_profile || {};

        res.json({
            buyer_profile_completed: user.buyer_profile_completed,
            buyer_profile: {
                location: buyerProfile.location || '',
                companyName: buyerProfile.companyName || '',
                productsNeeded: buyerProfile.productsNeeded || '',
                preferredQuantities: buyerProfile.preferredQuantities || ''
            }
        });
    } catch (error) {
        console.error('Error fetching buyer profile:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/home/AcceptRequest', authenticateToken, async (req, res) => {
    const { request_id } = req.body;

    try {
        const userEmail = req.user.email;

        const accepterQuery = `SELECT user_id FROM users WHERE email = $1`;
        const accepterResult = await db.query(accepterQuery, [userEmail]);

        if (accepterResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const accepterId = accepterResult.rows[0].user_id;

        const requestQuery = `SELECT user_id FROM requests WHERE request_id = $1`;
        const requestResult = await db.query(requestQuery, [request_id]);

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: "Request not found." });
        }

        const requestCreatorId = requestResult.rows[0].user_id;

        if (requestCreatorId === accepterId) {
            return res.status(400).json({ error: "You cannot accept your own request." });
        }

        await db.query(
            `UPDATE requests 
             SET accepted_by = $1, status = 'accepted' 
             WHERE request_id = $2`,
            [userEmail, request_id]
        );

        await db.query(
            `INSERT INTO chats (request_id, sender_id, receiver_id, message) 
             VALUES ($1, $2, $3, '') 
             ON CONFLICT DO NOTHING`,
            [request_id, requestCreatorId, accepterId]
        );

        res.redirect('/home');
    } catch (err) {
        console.error('Error accepting request:', err);
        res.status(500).send('Error accepting request.');
    }
});


app.get('/chat_list/:userId', authenticateToken, async (req, res) => {
    const userId = req.params.userId;  
    console.log("User ID:", userId);

    try {
        const query = `
            SELECT 
                r.request_id, r.crop_name, 
                u1.name AS farmer_name, u1.user_id AS farmer_id,
                u2.name AS buyer_name, u2.user_id AS buyer_id
            FROM requests r
            JOIN users u1 ON u1.user_id = r.user_id  -- Farmer (request creator)
            JOIN users u2 ON u2.user_id = (SELECT user_id FROM users WHERE email = r.accepted_by)  -- Buyer (who accepted)
            WHERE r.status = 'accepted' 
              AND ($1 = u1.user_id OR $1 = u2.user_id)  -- Only involved users can see
        `;

        const { rows } = await db.query(query, [userId]);

        if (rows.length === 0) {
            return res.render("chat_list.ejs", { chats: [] });
        }

        res.render("chat_list.ejs", { chats: rows });
    } catch (error) {
        console.error("Error fetching chat list:", error);
        res.status(500).send("Server error");
    }
});

app.get('/chat', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.query;  
        const senderId = req.user?.user_id;  // User making the request

        if (!requestId || !senderId) {
            return res.status(400).send("Missing chat details.");
        }

        console.log("Fetching chat for Request ID:", requestId);
        console.log("Sender ID:", senderId);

        // Fetch chat details, including the receiver ID
        const chatInfo = await db.query(
            `SELECT DISTINCT sender_id, receiver_id 
             FROM chats 
             WHERE request_id = $1 
             LIMIT 1`,
            [requestId]
        );

        if (chatInfo.rows.length === 0) {
            return res.status(404).send("Chat not found.");
        }

        // Determine receiverId (not the current user)
        const { sender_id, receiver_id } = chatInfo.rows[0];
        const chatPartnerId = sender_id === senderId ? receiver_id : sender_id;

        console.log("Receiver ID:", chatPartnerId);

        // Fetch chat messages
        const { rows: chatMessages } = await db.query(
            `SELECT sender_id, message, timestamp 
             FROM chats 
             WHERE request_id = $1 
             ORDER BY timestamp ASC`,
            [requestId]
        );

        res.render("chat.ejs", {
            user: req.user,
            requestId,
            receiverId: chatPartnerId,  // Receiver is fetched dynamically
            senderId,
            messages: chatMessages || []
        });
    } catch (error) {
        console.error("Error fetching chat messages:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/storeMessage', authenticateToken, async (req, res) => {
    const { senderId, receiverId, requestId, messageText } = req.body;

    try {
        await db.query(
            `INSERT INTO chats (request_id, sender_id, receiver_id, message) 
             VALUES ($1, $2, $3, $4)`,
            [requestId, senderId, receiverId, messageText]
        );

        res.status(200).json({ success: true, message: "Message stored successfully." });
    } catch (err) {
        console.error('Error storing message:', err);
        res.status(500).json({ error: "Error storing message." });
    }
});




app.get('/payment', (req, res) => {
    res.render('payment');
});



app.listen(port, () => console.log(`Server running on port ${port}`));
