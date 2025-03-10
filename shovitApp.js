import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import bodyParser from "body-parser";  // ✅ Ensure body-parser is imported
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

function formatProposals(proposals) {
    const lowerLimit = Math.floor(proposals / 5) * 5;
    const upperLimit = lowerLimit + 5;
    return `${lowerLimit} to ${upperLimit}`;
}


//middleweeerrrrr
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


app.get('/home', async (req, res) => {
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


app.get('/search', async (req, res) => {
    const searchQuery = req.query.query;

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

app.listen(3000);