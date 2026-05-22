const authService = require('../services/auth.service');

class AuthController {
  async register(req, res) {
    try {
      const { username, email, password } = req.body;
      const result = await authService.register(username, email, password);

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  async logout(req, res) {
    await authService.setUserOnline(req.user.userId, false).catch(() => undefined);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  }

  async getProfile(req, res) {
    try {
      const user = await authService.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();
