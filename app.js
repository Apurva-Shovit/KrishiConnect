import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";


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

app.get("/", (req, res) => {
    res.render("landing.ejs");
});
app.get("/login", (req, res) => {
    res.render("login.ejs");
});
app.get("/register",(req,res)=>{
    res.render("register.ejs");
});



app.use(express.static(path.join(__dirname,'public')));
app.use(express.json());




app.listen(port, () => console.log(`server running on ${port}`));
