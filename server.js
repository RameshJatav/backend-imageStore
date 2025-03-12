require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const cors = require("cors");
const redis = require('redis');
const db = require('./connections/mysql');

const app = express();
const client = redis.createClient();

// Middleware
app.use(bodyParser.json());
app.use(fileUpload());
app.use(cors());

// Redis Error Handling
client.on('error', (err) => console.log('Redis Error:', err));

// ✅ Middleware to Verify Email in Body
const verifyEmail = (req, res, next) => {
    if (!req.body.email) {
        return res.status(400).json({ message: 'Email ID is required.' });
    }
    req.email = req.body.email;
    next();
};

// ✅ Middleware to Verify Email from Headers
const verifyEmail1 = (req, res, next) => {
    const email = req.headers.authorization?.split(' ')[1]; 
    if (!email) {
        return res.status(401).json({ message: 'Unauthorized: No email provided.' });
    }
    req.email = email;
    next();
};

// ✅ Caching Middleware (Improves Performance)
const cacheMiddleware = (req, res, next) => {
    client.get(req.email, (err, data) => {
        if (err) throw err;
        if (data) {
            return res.json(JSON.parse(data));  // ✅ Fast response from Redis
        }
        next();
    });
};

// ✅ Upload Image API
app.post('/api/upload', verifyEmail, (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
    let uploadPromises = files.map((file) => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO images (image_name, image_url, email_id) VALUES (?, ?, ?)',
                [file.name, file.data, req.email],
                (err, result) => {
                    if (err) return reject(err);
                    resolve({ id: result.insertId, imageName: file.name });
                }
            );
        });
    });

    Promise.all(uploadPromises)
        .then((results) => res.status(200).json({ success: true, images: results }))
        .catch((err) => res.status(500).send(err.message));
});

// ✅ Fetch All Images (With Pagination & Caching)
app.get('/api/images', verifyEmail1, cacheMiddleware, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    db.query(
        'SELECT id, image_name FROM images WHERE email_id = ? ORDER BY uploaded_at DESC LIMIT ? OFFSET ?',
        [req.email, limit, offset],
        (err, results) => {
            if (err) return res.status(500).json({ message: 'Failed to fetch images.' });

            client.setex(req.email, 3600, JSON.stringify(results));  // ✅ Cache for 1 hour
            res.json(results);
        }
    );
});

// ✅ Fetch Single Image
app.get('/api/show_one/:id', verifyEmail1, (req, res) => {
    db.query(
        'SELECT id, image_name, image_url FROM images WHERE id = ? AND email_id = ?',
        [req.params.id, req.email],
        (err, results) => {
            if (err) return res.status(500).send('Failed to fetch image.');
            if (results.length === 0) return res.status(404).json({ message: 'Image not found.' });

            const image = results[0];
            res.json({
                id: image.id,
                imageName: image.image_name,
                imageUrl: `data:image/jpeg;base64,${image.image_url.toString('base64')}`,
            });
        }
    );
});

// ✅ Delete Image (Move to Archive)
app.delete('/api/deletephoto/:id', verifyEmail1, (req, res) => {
    db.query('SELECT * FROM images WHERE id = ? AND email_id = ?', [req.params.id, req.email], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ message: 'Photo not found.' });

        const photo = results[0];
        db.query(
            'INSERT INTO deleted_images_tb (id, image_name, image_url, email_id, deleted_at) VALUES (?, ?, ?, ?, NOW())',
            [photo.id, photo.image_name, photo.image_url, req.email],
            (insertError) => {
                if (insertError) return res.status(500).json({ message: 'Failed to archive deleted photo.' });

                db.query('DELETE FROM images WHERE id = ? AND email_id = ?', [req.params.id, req.email], (deleteError) => {
                    if (deleteError) return res.status(500).json({ message: 'Failed to delete photo.' });

                    res.json({ message: 'Photo deleted and archived successfully.' });
                });
            }
        );
    });
});

// ✅ Recover Deleted Image
app.post('/api/recoverphoto/:id', verifyEmail1, (req, res) => {
    db.query('SELECT * FROM deleted_images_tb WHERE id = ? AND email_id = ?', [req.params.id, req.email], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ message: 'Photo not found.' });

        const photo = results[0];
        db.query(
            'INSERT INTO images (id, image_name, image_url, email_id) VALUES (?, ?, ?, ?)',
            [photo.id, photo.image_name, photo.image_url, photo.email_id],
            (insertError) => {
                if (insertError) return res.status(500).json({ message: 'Failed to recover photo.' });

                db.query('DELETE FROM deleted_images_tb WHERE id = ? AND email_id = ?', [req.params.id, req.email], (deleteError) => {
                    if (deleteError) return res.status(500).json({ message: 'Failed to delete from archive.' });

                    res.json({ message: 'Photo recovered successfully.' });
                });
            }
        );
    });
});

// ✅ Fetch All Deleted Images
app.get('/api/images_deleted_all', verifyEmail1, (req, res) => {
    db.query(
        'SELECT id, image_name, deleted_at FROM deleted_images_tb WHERE email_id = ? ORDER BY deleted_at DESC',
        [req.email],
        (err, results) => {
            if (err) return res.status(500).json({ message: 'Failed to fetch deleted images.' });
            res.json(results);
        }
    );
});

// ✅ Truncate (Delete All Images)
app.delete('/api/deleteall', (req, res) => {
    db.query('TRUNCATE TABLE images', (error, result) => {
        if (error) {
            console.error('Error executing query:', error);
            return res.status(500).send('Internal server error: Unable to delete records.');
        }
        res.send('All records deleted successfully.');
    });
});

// ✅ Server Start
const port = process.env.PORT || 3002;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
