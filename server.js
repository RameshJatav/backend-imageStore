require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const cors = require("cors");
const db = require('./connections/mysql');
const userApis = require("./routes/Users");

const app = express();

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

// ✅ Upload API
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
        .then((results) => res.status(200).json({ success: true, images: results }))
        .catch((err) => res.status(500).send(err.message));
});

// ✅ Fetch Images API
app.get('/api/images', verifyEmail1, (req, res) => {
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
            res.json(images);
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

// ✅ Delete Photo (Move to archive)
app.delete('/api/deletephoto/:id', (req, res) => {
    db.query('SELECT * FROM images WHERE id = ? AND email_id = ?', [req.params.id, req.email], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ message: 'Photo not found.' });

        const photo = results[0];
        const deletedAt = new Date();

        db.query(
            'INSERT INTO deleted_images_tb (id, imageName, imageUrl, email_id, deletedAt) VALUES (?, ?, ?, ?, ?)',
            [photo.id, photo.image_name, photo.image_url, req.email, deletedAt],
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

// ✅ Recover Photo
app.delete('/api/recoverphoto/:id', (req, res) => {
    db.query('SELECT * FROM deleted_images_tb WHERE id = ? AND email_id = ?', [req.params.id, req.query.email], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ message: 'Photo not found.' });

        const photo = results[0];

        db.query(
            'INSERT INTO images (id, image_name, image_url, email_id) VALUES (?, ?, ?, ?)',
            [photo.id, photo.imageName, photo.imageUrl, photo.email_id],
            (insertError) => {
                if (insertError) return res.status(500).json({ message: 'Failed to recover photo.' });

                db.query('DELETE FROM deleted_images_tb WHERE id = ? AND email_id = ?', [req.params.id, req.query.email], (deleteError) => {
                    if (deleteError) return res.status(500).json({ message: 'Failed to delete from archive.' });

                    res.json({ message: 'Photo recovered successfully.' });
                });
            }
        );
    });
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
