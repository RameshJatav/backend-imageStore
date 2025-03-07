const express = require('express');
const db = require('../connections/mysql');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { error } = require('console');

const router = express.Router();

router.use(bodyParser.json());

// // Email setup using Nodemailer
// const transporter = nodemailer.createTransport({
//     service: 'gmail', // You can use any email service
//     auth: {
//         user: 'Testrj8@gmail.com',  // Replace with your email
//         pass: 'timl uefj hxok ahnh',    // Replace with your email password
//     },
// });

// // Function to send OTP to email
// const sendOTP = (email, otp) => {
//     const mailOptions = {
//         from: 'Testrj8@gmail.com',
//         to: email,
//         subject: 'Your OTP for Registration/Login',
//         text: `Your OTP is: ${otp}`,
//     };

//     return transporter.sendMail(mailOptions);
// };

// // Generate OTP (6 digits)
// const generateOTP = () => {
//     return Math.floor(100000 + Math.random() * 900000).toString();
// };

// // API to register a new user
// router.post('/api/register', (req, res) => {
//     const { email_id } = req.body;

//     if (!email_id) {
//         return res.status(400).json({ message: 'Email is required.' });
//     }

//     db.query('SELECT * FROM users_tb WHERE email_id = ?', [email_id], (err, results) => {
//         if (err) {
//             console.error('Error checking email:', err);
//             return res.status(500).json({ message: 'Internal Server Error.' });
//         }

//         if (results.length > 0) {
//             return res.status(400).json({ message: 'User already exists with this email.' });
//         }

//         db.query(
//             'INSERT INTO users_tb (email_id) VALUES (?)',
//             [email_id],
//             (insertErr, result) => {
//                 if (insertErr) {
//                     console.error('Error inserting user:', insertErr);
//                     return res.status(500).json({ message: 'Error registering user.' });
//                 }

//                 const userId = result.insertId;
//                 const otp = generateOTP(); // Generate OTP
//                 const otpExpiry = new Date();
//                 otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP expires in 10 minutes

//                 db.query(
//                     'INSERT INTO otp_tb (userId, otp, otp_expiry) VALUES (?, ?, ?)',
//                     [userId, otp, otpExpiry],
//                     (otpErr) => {
//                         if (otpErr) {
//                             console.error('Error inserting OTP:', otpErr);
//                             return res.status(500).json({ message: 'Error sending OTP.' });
//                         }

//                         sendOTP(email_id, otp)
//                             .then(() => {
//                                 res.status(200).json({ message: 'Registration successful. Please check your email for the OTP.' });
//                             })
//                             .catch((emailErr) => {
//                                 console.error('Error sending OTP:', emailErr);
//                                 res.status(500).json({ message: 'Failed to send OTP.' });
//                             });
//                     }
//                 );
//             }
//         );
//     });
// });

// // API to verify OTP and set password
// router.post('/api/verify-otp', (req, res) => {
//     const { email_id, otp, newPassword, confirmPassword } = req.body;

//     if (!email_id || !otp || !newPassword || !confirmPassword) {
//         return res.status(400).json({ message: 'Email, OTP, new password, and confirm password are required.' });
//     }

//     if (newPassword !== confirmPassword) {
//         return res.status(400).json({ message: 'Passwords do not match.' });
//     }

//     db.query('SELECT * FROM users_tb WHERE email_id = ?', [email_id], (err, results) => {
//         if (err) {
//             console.error('Error fetching user:', err);
//             return res.status(500).json({ message: 'Internal Server Error.' });
//         }

//         if (results.length === 0) {
//             return res.status(404).json({ message: 'User not found.' });
//         }

//         const user = results[0];
//         db.query('SELECT * FROM otp_tb WHERE userId = ? ORDER BY otpId DESC LIMIT 1', [user.userId], (otpErr, otpResults) => {
//             if (otpErr) {
//                 console.error('Error fetching OTP:', otpErr);
//                 return res.status(500).json({ message: 'Internal Server Error.' });
//             }

//             if (otpResults.length === 0) {
//                 return res.status(400).json({ message: 'No OTP found for this user.' });
//             }

//             const otpRecord = otpResults[0];
//             const otpExpiry = new Date(otpRecord.otp_expiry);

//             if (otp !== otpRecord.otp) {
//                 return res.status(400).json({ message: 'Invalid OTP.' });
//             }

//             if (new Date() > otpExpiry) {
//                 return res.status(400).json({ message: 'OTP has expired.' });
//             }

//             const hashedPassword = bcrypt.hashSync(newPassword, 10); // Hash the new password

//             db.query(
//                 'UPDATE users_tb SET password = ? WHERE userId = ?',
//                 [hashedPassword, user.userId],
//                 (updateErr) => {
//                     if (updateErr) {
//                         console.error('Error updating password:', updateErr);
//                         return res.status(500).json({ message: 'Failed to update password.' });
//                     }

//                     db.query('DELETE FROM otp_tb WHERE userId = ?', [user.userId], (deleteOtpErr) => {
//                         if (deleteOtpErr) {
//                             console.error('Error deleting OTP:', deleteOtpErr);
//                         }
//                     });

//                     res.status(200).json({ message: 'Password updated successfully. You can now log in.' });
//                 }
//             );
//         });
//     });
// });

// // API for user login
// router.post('/api/login', (req, res) => {
//     const { email_id, password } = req.body;

//     if (!email_id || !password) {
//         return res.status(400).json({ message: 'Email and password are required.' });
//     }

//     db.query('SELECT * FROM users_tb WHERE email_id = ?', [email_id], (err, results) => {
//         if (err) {
//             console.error('Error fetching user:', err);
//             return res.status(500).json({ message: 'Internal Server Error.' });
//         }

//         if (results.length === 0) {
//             return res.status(404).json({ message: 'User not found.' });
//         }

//         const user = results[0];
//         const passwordMatch = bcrypt.compareSync(password, user.password);

//         if (!passwordMatch) {
//             return res.status(400).json({ message: 'Invalid email or password.' });
//         }

//         res.status(200).json({ message: 'Login successful.' });
//     });
// });

 

// Register a user
router.post("/user_register", async (req, res) => {
    const { email_id, password } = req.body;
    const currentDate = new Date();

    if (!email_id || !password) {
        return res.status(400).json({ message: "All fields are required." });
    }

    try {
        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the user into the database
        const query = `INSERT INTO users_tb ( email_id, password, createAt) VALUES ( ?, ?, ?)`;
        db.query(query, [ email_id, hashedPassword, currentDate], (error, result) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ message: "Internal server error." });
            }
            res.status(201).json({ message: "User registered successfully." });
        });
    } catch (error) {
        // console.error(error);
        res.status(500).json({ message: "Error registering user." });
    }
});

// Login a user
router.post("/user_login", (req, res) => {
    const { email_id, password } = req.body;

    if (!email_id || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        // Fetch user by email
        const query = `SELECT * FROM users_tb WHERE email_id = ?`;
        db.query(query, [email_id], async (error, rows) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ message: "Internal server error." });
            }

            if (rows.length === 0) {
                return res.status(404).json({ message: "User not found." });
            }

            const user = rows[0];

            // Compare the password
            const isPasswordMatch = await bcrypt.compare(password, user.password);
            if (!isPasswordMatch) {
                return res.status(401).json({ message: "Invalid email or Password !." });
            }

            res.status(200).json({ message: "Login successful.", user });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error logging in." });
    }
});

// Update user details by email
router.put("/user_update", async (req, res) => {
    const { email_id, newEmail, newPassword } = req.body;

    if (!email_id || (!newEmail && !newPassword)) {
        return res.status(400).json({ message: "Email and at least one field to update are required." });
    }

    try {
        let query = `UPDATE users_tb SET `;
        const params = [];

        if (newEmail) {
            query += `email_id = ?, `;
            params.push(newEmail);
        }

        if (newPassword) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            query += `password = ?, `;
            params.push(hashedPassword);
        }

        query = query.slice(0, -2); // Remove the last comma
        query += ` WHERE email_id = ?`;
        params.push(email_id);

        db.query(query, params, (error, result) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ message: "Database error." });
            }

            res.status(200).json({ message: "User details updated successfully." });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating user details." });
    }
});

// Get user details by email
router.get("/user_get", (req, res) => {
    const { email_id } = req.query;

    if (!email_id) {
        return res.status(400).json({ message: "Email is required." });
    }

    try {
        const query = `SELECT userId, email_id, createAt FROM users_tb WHERE email_id = ?`;
        db.query(query, [email_id], (error, rows) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ message: "Database error." });
            }

            if (rows.length === 0) {
                return res.status(404).json({ message: "User not found." });
            }

            res.status(200).json(rows[0]);
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error retrieving user details." });
    }
});

 
router.post('/api/change-password', async (req, res) => {
    const { email_id, oldPassword, newPassword, confirmPassword } = req.body;

     if (!email_id || !oldPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

     if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New password and confirm password do not match.' });
    }

    try {
        // Fetch user from the database by email_id
        const query = 'SELECT password FROM users_tb WHERE email_id = ?';
        db.query(query, [email_id], async (error, results) => {
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ message: 'Internal server error.' });
            }

            // Check if user exists
            if (results.length === 0) {
                return res.status(404).json({ message: 'User not found.' });
            }

            const storedPassword = results[0].password;

            // Compare old password with stored password
            const isPasswordValid = await bcrypt.compare(oldPassword, storedPassword);
            if (!isPasswordValid) {
                return res.status(400).json({ message: 'Old password is incorrect.' });
            }

            // Hash the new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update the password in the database
            const updateQuery = 'UPDATE users_tb SET password = ? WHERE email_id = ?';
            db.query(updateQuery, [hashedPassword, email_id], (updateError) => {
                if (updateError) {
                    console.error('Error updating password:', updateError);
                    return res.status(500).json({ message: 'Failed to update password.' });
                }

                res.status(200).json({ message: 'Password changed successfully.' });
            });
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;
