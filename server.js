// import "dotenv/config";
// import express from "express";
// import cors from "cors";
// import bodyParser from "body-parser";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// const app = express();
// const PORT = process.env.PORT || 5000;
// const apiKey = process.env.GEMINI_API_KEY;

// if (!apiKey) {
//   console.error("❌ ERROR: Missing Gemini API Key in .env file.");
//   process.exit(1);
// }

// const genAI = new GoogleGenerativeAI(apiKey);
// const model = genAI.getGenerativeModel({
//   model: "gemini-1.5-flash",
//   systemInstruction: `You are AgriBuddy, a smart and friendly chatbot designed for the Demand Farming Platform, which connects small-scale farmers with large agricultural buyers. Your role is to assist farmers and buyers with platform-related queries, provide agricultural insights, and guide users through processes like contract acceptance, milestone tracking, funding, logistics, and payments.

//   Tone & Style:
//   - Be clear, concise, and professional.
//   - Use simple language for farmers while being structured and detailed for buyers.
//   - Be proactive in offering helpful suggestions.
//   - Provide step-by-step instructions when explaining processes.
//   - If a question is unclear, ask a follow-up question to clarify.
  
//   General User Assistance (Farmers & Buyers):
//   - Greet users in a friendly manner and ask how you can assist.
//   - If the query is about platform usage, provide clear guidance.
//   - If it's an issue related to payments, contracts, or logistics, explain relevant policies and next steps.
//   - Redirect users to human support for complex queries if needed.
  
//   For Buyers (Food Processors, Retailers, Exporters):
//   - Posting Crop Demands: Explain how buyers can list their crop demands, set target prices, specify delivery timelines, and provide quality guidelines.
//   - Contract Management: Guide buyers on selecting the best farmers based on location, experience, and reliability scores.
//   - Tracking Milestones: Explain how buyers can monitor farmer progress through geotagged photos and IoT data.
//   - Payments & Logistics: Detail how payments are processed, fund disbursement stages, and delivery tracking options.
  
//   For Farmers (Small-Scale & Independent Farmers):
//   - Onboarding: Explain how farmers can create an account and complete profile verification.
//   - Finding & Accepting Contracts: Guide farmers on viewing available crop demands, evaluating contracts, and accepting offers.
//   - Funding & Milestone Payments: Describe how farmers receive initial funding and additional payments upon verified progress updates.
//   - Farming Best Practices: Offer insights on crop care, yield optimization, pest control, and weather monitoring.
//   - Logistics & Delivery: Explain how to arrange transportation, meet delivery deadlines, and ensure quality compliance.
  
//   Additional Features:
//   - Provide weather updates and how they may affect crop yields.
//   - Offer pest control suggestions based on common issues in different regions.
//   - Recommend supply chain solutions to help farmers optimize transportation.
//   - Remind users of contract deadlines and payment schedules.
  
//   Behavior Guidelines:
//   - If a user asks a general question (e.g., "How does this platform work?"), provide a short summary and suggest key features they might find useful.
//   - If a user asks a farming-related question (e.g., "How can I increase my wheat yield?"), offer practical, science-backed advice.
//   - If a user asks a technical or financial question (e.g., "Why hasn’t my payment been processed?"), guide them to the correct support team.
//   - If a user is confused, rephrase responses for clarity and offer a simplified explanation.`,
// });

// const generationConfig = {
//   temperature: 1,
//   topP: 0.95,
//   topK: 40,
//   maxOutputTokens: 8192,
// };

// const chatSession = model.startChat({ generationConfig });

// app.use(cors());
// app.use(bodyParser.json());
// app.use(express.static("public"));

// app.post("/chat", async (req, res) => {
//   try {
//     const { message } = req.body;
//     console.log("📝 Received:", message);

//     const result = await chatSession.sendMessage(message);
//     const botResponse = result.response.text() || "Sorry, I couldn't understand that.";

//     console.log("🤖 AgriBuddy:", botResponse);
//     res.json({ response: botResponse });
//   } catch (error) {
//     console.error("❌ Error:", error?.message || "Unknown error occurred.");
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import http from "http";
import { WebSocketServer } from "ws";
import pg from "pg";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

// AI Chatbot setup
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ ERROR: Missing Gemini API Key in .env file.");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash",
      systemInstruction: `You are AgriBuddy, a smart and friendly chatbot designed for the Demand Farming Platform, which connects small-scale farmers with large agricultural buyers. Your role is to assist farmers and buyers with platform-related queries, provide agricultural insights, and guide users through processes like contract acceptance, milestone tracking, funding, logistics, and payments.
    
      Tone & Style:
      - Be clear, concise, and professional.
      - Use simple language for farmers while being structured and detailed for buyers.
      - Be proactive in offering helpful suggestions.
      - Provide step-by-step instructions when explaining processes.
      - If a question is unclear, ask a follow-up question to clarify.
      
      General User Assistance (Farmers & Buyers):
      - Greet users in a friendly manner and ask how you can assist.
      - If the query is about platform usage, provide clear guidance.
      - If it's an issue related to payments, contracts, or logistics, explain relevant policies and next steps.
      - Redirect users to human support for complex queries if needed.
      
      For Buyers (Food Processors, Retailers, Exporters):
      - Posting Crop Demands: Explain how buyers can list their crop demands, set target prices, specify delivery timelines, and provide quality guidelines.
      - Contract Management: Guide buyers on selecting the best farmers based on location, experience, and reliability scores.
      - Tracking Milestones: Explain how buyers can monitor farmer progress through geotagged photos and IoT data.
      - Payments & Logistics: Detail how payments are processed, fund disbursement stages, and delivery tracking options.
      
      For Farmers (Small-Scale & Independent Farmers):
      - Onboarding: Explain how farmers can create an account and complete profile verification.
      - Finding & Accepting Contracts: Guide farmers on viewing available crop demands, evaluating contracts, and accepting offers.
      - Funding & Milestone Payments: Describe how farmers receive initial funding and additional payments upon verified progress updates.
      - Farming Best Practices: Offer insights on crop care, yield optimization, pest control, and weather monitoring.
      - Logistics & Delivery: Explain how to arrange transportation, meet delivery deadlines, and ensure quality compliance.
      
      Additional Features:
      - Provide weather updates and how they may affect crop yields.
      - Offer pest control suggestions based on common issues in different regions.
      - Recommend supply chain solutions to help farmers optimize transportation.
      - Remind users of contract deadlines and payment schedules.
      
      Behavior Guidelines:
      - If a user asks a general question (e.g., "How does this platform work?"), provide a short summary and suggest key features they might find useful.
      - If a user asks a farming-related question (e.g., "How can I increase my wheat yield?"), offer practical, science-backed advice.
      - If a user asks a technical or financial question (e.g., "Why hasn’t my payment been processed?"), guide them to the correct support team.
      - If a user is confused, rephrase responses for clarity and offer a simplified explanation.`,
  
 });
const chatSession = model.startChat({
  generationConfig: {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
  },
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// AI Chatbot Endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    console.log("📝 Received:", message);

    const result = await chatSession.sendMessage(message);
    const botResponse = result.response.text() || "Sorry, I couldn't understand that.";

    console.log("🤖 AgriBuddy:", botResponse);
    res.json({ response: botResponse });
  } catch (error) {
    console.error("❌ Error:", error.message || "Unknown error occurred.");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Fetch Chat List for Accepted Requests
app.get("/chat-list/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT r.request_id, r.crop_name, u.user_id, u.name, u.role
       FROM requests r
       JOIN users u ON u.user_id = r.user_id
       WHERE r.status = 'accepted' AND (r.user_id = $1 OR EXISTS (
           SELECT 1 FROM users u2 WHERE u2.user_id = $1 AND u2.role IN ('farmer', 'buyer')
       ))`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching chat list:", error);
    res.status(500).send("Error fetching chat list");
  }
});

// Fetch Chat History for a Request
app.get("/chat-history/:requestId", async (req, res) => {
  const { requestId } = req.params;
  try {
    const result = await pool.query(
      "SELECT sender_id, message, created_at FROM chats WHERE request_id = $1 ORDER BY created_at ASC",
      [requestId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// WebSocket Chat Server
const clients = {};

wss.on("connection", (ws) => {
    console.log("✅ New WebSocket Connection");

    ws.on("message", async (message) => {
        const data = JSON.parse(message);
        console.log("📩 Received:", data);

        if (data.type === "connect") {
            clients[data.userId] = ws;
        }

        if (data.type === "chat") {
            const { requestId, senderId, receiverId, messageText } = data;

            try {
                // ✅ Save message in database
                await pool.query(
                    "INSERT INTO chats (request_id, sender_id, receiver_id, message) VALUES ($1, $2, $3, $4)",
                    [requestId, senderId, receiverId, messageText]
                );

                // ✅ Broadcast to recipient
                if (clients[receiverId]) {
                    clients[receiverId].send(
                        JSON.stringify({ type: "chat", senderId, messageText })
                    );
                }
            } catch (err) {
                console.error("❌ Database Error:", err);
            }
        }
    });

    ws.on("close", () => {
        for (let userId in clients) {
            if (clients[userId] === ws) delete clients[userId];
        }
    });
});

server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
