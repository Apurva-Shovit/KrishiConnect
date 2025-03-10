CREATE DATABASE "KrishiConnect";
\c "KrishiConnect";
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone_number VARCHAR(15),
    location VARCHAR(255),
    buyer_profile JSONB,
    farmer_profile JSONB,
    buyer_verified BOOLEAN DEFAULT FALSE,
    farmer_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON Users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TABLE Requests (
    request_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id),
    crop_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    price_offered DECIMAL(10, 2) NOT NULL,
    delivery_deadline DATE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trigger_requests_updated_at
BEFORE UPDATE ON Requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TABLE AcceptedRequests (
    acceptance_id SERIAL PRIMARY KEY,
    request_id INT REFERENCES Requests(request_id),
    accepted_by INT REFERENCES Users(user_id),
    status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected')),
    expected_harvest_date DATE
);

CREATE TABLE Milestones (
    milestone_id SERIAL PRIMARY KEY,
    acceptance_id INT REFERENCES AcceptedRequests(acceptance_id),
    milestone_description TEXT NOT NULL,
    expected_completion_date DATE,
    order_position INT,
    payment_percentage DECIMAL(5, 2),
    status VARCHAR(20) CHECK (status IN ('pending', 'approved')),
    payment_status VARCHAR(20) CHECK (payment_status IN ('unpaid', 'paid')),
    admin_id INT REFERENCES Users(user_id),
    revision_history JSONB,
    progress_status VARCHAR(50),
    progress_images JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trigger_milestones_updated_at
BEFORE UPDATE ON Milestones
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TABLE Chats (
    chat_id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES Users(user_id),
    receiver_id INT REFERENCES Users(user_id),
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    request_id INT REFERENCES Requests(request_id)
);

CREATE TABLE Payments (
    payment_id SERIAL PRIMARY KEY,
    acceptance_id INT REFERENCES AcceptedRequests(acceptance_id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'completed')),
    transaction_id VARCHAR(100),
    payment_date TIMESTAMP
);
