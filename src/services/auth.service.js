const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const database = require('../database/database')
 
class AuthService {
    async register(username, email, password) {
        console.log('AuthService: Register called with', { username, email });
        const existingUser = await database.get('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser) {
            throw new Error('User already exists');
        }
        const usernameExists = await database.get('SELECT * FROM users WHERE username = $1', [username]);
        if (usernameExists) {
            throw new Error('Username already taken');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id';
        const values = [username, email, hashedPassword];
        const result = await database.query(query, values);
        const userId = result[0].id;
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '8h' });
        return { token, user: {id: userId, username, email}};
    }
     async login(email, password) {
        const user = await database.get('SELECT * FROM users WHERE email = $1',
        [email]);
        if (!user) {
            throw new Error('Invalid email or password');
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            throw new Error('Invalid email or password');
        }
        await database.run('UPDATE users SET is_online = TRUE, last_login = NOW() WHERE id = $1',[user.id]);
        const token = jwt.sign(
            { id: user.id, email: user.email }, 
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        return { token, user: { id: user.id, email: user.email } };
    }
 
     async getProfile(userId) {
        const result = await database.get('SELECT id, username, email, is_online FROM users WHERE id = $1', [userId]);
        
        // Se o Postgre devolver um objeto com a propriedade rows:
        if (result && result.rows) {
            return result.rows[0];
        }
        
        // Se o seu database.get já devolver a linha direto:
        return result;
    }
     async setUserOnlineStatus(userId, isOnline) {
        await database.run('UPDATE users SET is_online = $1 WHERE id = $2', [isOnline, userId]);
    }
}
module.exports = new AuthService();