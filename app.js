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
    database: "KrishiConnect",
    password: "password",
    port: 5432,
});


db.connect();

//middleweeerrrrr
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// routessss 
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
    console.log("Received registration request"); // ✅ Debug log
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

            res.send("User registed!"); // Redirect after success
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
        res.send("Login Success!"); // Redirect to the secrets page upon successful login
      } else {
        res.status(401).send("Incorrect Password"); // Unauthorized access
      }
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).send("Server error");
    }
  });
  

// Start the server
app.listen(port, () => console.log(`Server running on port ${port}`));
