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
    user: "postgres",
    host: "localhost",
    database: "KrishiConnect1",
    password: "rootuser",
    port: 5432,
});


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
                `SELECT email, farmer_profile_completed, buyer_profile_completed 
                 FROM users WHERE email = $1`, 
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(404).send("User not found");
            }

            const dbUser = result.rows[0];
            req.user = {
                ...dbUser,
                profileStatus: dbUser.farmer_profile_completed
                    ? 'farmer'
                    : dbUser.buyer_profile_completed
                    ? 'buyer'
                    : 'incomplete'
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



//  register user
app.post("/reguser", async (req, res) => {
    console.log("Received registration request"); // ✅ Debug log
    console.log("Request Body:", req.body);
    const { fname, lname, username: email, password } = req.body;

    try {
        // Check if email exists
        const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (checkResult.rows.length > 0) {
            
            return res.render('register.ejs', { errorMessage : 'user already exists'});
        }

        // Hash password and store user
        bcrypt.hash(password, saltRounds, async (err, hash) => {
            if (err) {
                console.error("Error hashing password:", err);
                return res.status(500).send("Server error. Please try again.");
            }

            console.log("Hashed Password:", hash);

            await db.query(
                "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'user')",
                [fname+" "+lname, email, hash]
            );

            res.redirect("login"); // Redirect after success
        });

    } catch (err) {
        console.error("Database error:", err);
        res.status(500).send("Server error. Please try again.");
    }
});

//login user
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

        // Create JWT token
        const accessToken = jwt.sign(
            { email: user.email, id: user.id },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Send token in a cookie
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

        const [result, userResult] = await Promise.all([
            db.query('SELECT * FROM requests'),
            db.query('SELECT * FROM users WHERE email = $1', [req.user.email])
        ]);

        const userData = userResult.rows[0];
        result.rows.forEach(row => {
            row.delivery_deadline = row.delivery_deadline.toISOString().split('T')[0];
            row.proposals = formatProposals(row.proposals);
        })
        console.log(req.user)
        res.render('home', { 
            requests: result.rows,
            profileStatus: req.user.profileStatus,
            user: userData
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Server Error');
    } // Pass user data to EJS
});
app.get('/home/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

app.get('/home/search', async (req, res) => {
    const searchQuery = req.query.query || '';
    console.log(searchQuery);

    try {
        const result = await db.query(
            `SELECT * FROM requests 
             WHERE crop_name ILIKE $1 
             OR description ILIKE $1
             OR location ILIKE $1`, 
            [`%${searchQuery}%`]
        );
        result.rows.forEach(row => {
            row.delivery_deadline = row.delivery_deadline.toISOString().split('T')[0];
            row.proposals = formatProposals(row.proposals);
        })
        res.render('home', { requests: result.rows });
    } catch (error) {
        console.error('Error fetching search results:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/submit-farmer-profile',authenticateToken, (req, res) => {
    console.log(req.user);
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
    console.log('this is req.body',req.body);
    
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

    console.log(buyerProfile);
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

// Start the server
app.listen(port, () => console.log(`Server running on port ${port}`));
