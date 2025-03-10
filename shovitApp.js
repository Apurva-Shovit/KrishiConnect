import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import bodyParser from "body-parser";  
import pg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";


const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const saltRounds = 10;
const port = 3000;
const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "KrishiConnect1",
    password: "rootuser",
    port: 5432,
});


db.connect();
//middleweeerrrrr
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function formatProposals(proposals) {
    const lowerLimit = Math.floor(proposals / 5) * 5;
    const upperLimit = lowerLimit + 5;
    return `${lowerLimit} to ${upperLimit}`;
}


//vedant's app.js
app.get("/", (req, res) => {
    res.render("landing.ejs");  
});
app.get("/login", (req, res) => {
    res.render("login.ejs");
});
app.get("/register", (req, res) => {
    res.render("register.ejs");
});

//  register user
app.post("/reguser", async (req, res) => {
    console.log("Received registration request"); // 
    console.log("Request Body:", req.body);
    const { fname, lname, username: email, password } = req.body;

    try {
        // Check if email exists
        const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (checkResult.rows.length > 0) {
            return res.send("Email already exists. Try logging in.");
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

//login suer
app.post("/login", async (req, res) => {
    const email = req.body.username; // Changed from `username` to `email`
    const loginPassword = req.body.password;
    console.log(email+" : "+loginPassword);
  
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
  
      if (result.rows.length === 0) {
        return res.status(400).send("User not found");
      }
  
      const user = result.rows[0];
      const storedHashedPassword = user.password;
  
      // Compare the password securely
      const isMatch = await bcrypt.compare(loginPassword, storedHashedPassword);
  
      if (isMatch) {
        res.redirect("home"); // Redirect to the secrets page upon successful login
      } else {
        res.status(401).send("Incorrect Password"); // Unauthorized access
      }
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).send("Server error");
    }
  });



const verifyToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.redirect('/login');
        }

        req.userId = decoded.id;
        next();
    });
};



app.get('/home', verifyToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM requests');
        console.log(result.rows);
        result.rows.forEach(row => {
            row.delivery_deadline = row.delivery_deadline.toISOString().split('T')[0];
            row.proposals = formatProposals(row.proposals);
        })
        res.render('home', { requests: result.rows });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Server Error');
    }
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

app.get('/home/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

app.listen(3000);