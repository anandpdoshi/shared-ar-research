CREATE TABLE Users(
    UserId TEXT PRIMARY KEY,
    UserData TEXT,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Uploads(
    ID INTEGER PRIMARY KEY,
    UserId TEXT NOT NULL,
    Type TEXT NOT NULL DEFAULT 'File',
    Content TEXT NOT NULL,
    Marker TEXT NOT NULL,
    Layer TEXT NOT NULL DEFAULT 'Private',
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);