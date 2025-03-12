require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const cors = require("cors");
const NodeCache = require('node-cache');
const { db } = require('./connections/mysql');
const userApis = require("./routes/Users");
const mysql = require('mysql2');
const fs = require('fs');

const app = express();
const cache = new NodeCache({ stdTTL: 60 * 1000 }); // Cache expires every  minutes

// Middleware
app.use(bodyParser.json());
app.use(fileUpload());
app.use(cors());

// Routes
app.use("/users", userApis);

// Middleware to check if email is provided
const verifyEmail = (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email ID is required.' });
    }
    req.email = email;
    next();
};

const verifyEmail1 = (req, res, next) => {
    const email = req.headers.authorization?.split(' ')[1]; 
    if (!email) {
        return res.status(401).json({ message: 'Unauthorized: No email provided.' });
    }
    req.email = email;
    next();
};

// ✅ Upload API (Clears cache after upload)
app.post('/api/upload', verifyEmail, (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
    const { email } = req.body;

    let uploadPromises = files.map((file) => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO images (image_name, image_url, email_id) VALUES (?, ?, ?)',
                [file.name, file.data, email],
                (err, result) => {
                    if (err) return reject(err);
                    resolve({ id: result.insertId, imageName: file.name, imageData: file.data.toString('base64') });
                }
            );
        });
    });

    Promise.all(uploadPromises)
        .then((results) => {
            cache.del(`/api/images:${email}`); // Invalidate cache
            res.status(200).json({ success: true, images: results });
        })
        .catch((err) => res.status(500).send(err.message));
});

// ✅ Fetch Images API (Uses Cache)
app.get('/api/images', verifyEmail1, (req, res) => {
    const cacheKey = `/api/images:${req.email}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        return res.json(cachedData); // Return cached data
    }

    db.query(
        'SELECT id, image_name, image_url FROM images WHERE email_id = ? ORDER BY uploaded_at DESC',
        [req.email],
        (err, results) => {
            if (err) return res.status(500).json({ message: 'Failed to fetch images.' });

            const images = results.map((row) => ({
                id: row.id,
                imageName: row.image_name,
                imageUrl: `data:image/jpeg;base64,${row.image_url.toString('base64')}`,
            }));

            cache.set(cacheKey, images); // Store data in cache
            res.json(images);
        }
    );
});

// ✅ Fetch Single Image (Uses Cache)
app.get('/api/show_one/:id', verifyEmail1, (req, res) => {
    const cacheKey = `/api/show_one:${req.params.id}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        return res.json(cachedData); // Return cached data
    }

    db.query(
        'SELECT id, image_name, image_url FROM images WHERE id = ? AND email_id = ?',
        [req.params.id, req.email],
        (err, results) => {
            if (err) return res.status(500).send('Failed to fetch image.');
            if (results.length === 0) return res.status(404).json({ message: 'Image not found.' });

            const image = {
                id: results[0].id,
                imageName: results[0].image_name,
                imageUrl: `data:image/jpeg;base64,${results[0].image_url.toString('base64')}`,
            };

            cache.set(cacheKey, image); // Cache the result
            res.json(image);
        }
    );
});

// ✅ Delete All Images
app.get('/deleteall', (req, res) => {
    db.query('TRUNCATE TABLE images', (error) => {
        if (error) {
            console.error('Error executing query:', error);
            return res.status(500).send('Internal server error: Unable to delete records.');
        }
        cache.flushAll(); // Clear entire cache
        res.send('All records deleted successfully.');
    });
});

// ✅ Delete Photo (Clears cache)
app.delete('/api/deletephoto/:id', verifyEmail1, (req, res) => {
    db.query('DELETE FROM images WHERE id = ? AND email_id = ?', [req.params.id, req.email], (deleteError) => {
        if (deleteError) return res.status(500).json({ message: 'Failed to delete photo.' });

        cache.del(`/api/images:${req.email}`); // Invalidate cache
        res.json({ message: 'Photo deleted successfully.' });
    });
});

// ✅ Recover Photo (Clears cache)
app.delete('/api/recoverphoto/:id', (req, res) => {
    db.query('DELETE FROM deleted_images_tb WHERE id = ? AND email_id = ?', [req.params.id, req.query.email], (deleteError) => {
        if (deleteError) return res.status(500).json({ message: 'Failed to recover photo.' });

        cache.del(`/api/images:${req.query.email}`); // Invalidate cache
        res.json({ message: 'Photo recovered successfully.' });
    });
});



const port = process.env.PORT || 3002;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
