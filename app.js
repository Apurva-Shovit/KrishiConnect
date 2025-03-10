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
    database: "KrishiConnect",
    password: "password",
    port: 5432,
});


db.connect();

//middleweeerrrrr
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;  // Get token from cookies

    if (!token) {
        return res.status(401).redirect("/login"); // Redirect to login if no token
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).send("Invalid token");
        }
        req.user = user;
        next();
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
app.get("/home", authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM requests');
        console.log(result.rows);
        result.rows.forEach(row => {
            row.delivery_deadline = row.delivery_deadline.toISOString().split('T')[0];
            row.proposals = formatProposals(row.proposals);
        })
        res.render('home', { 
            requests: result.rows ,
            user: req.user
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Server Error');
    } // Pass user data to EJS
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
                "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
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
  
app.get('/home/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

// Start the server
app.listen(port, () => console.log(`Server running on port ${port}`));
