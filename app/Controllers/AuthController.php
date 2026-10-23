<?php
namespace App\Controllers;

use App\Models\User;
use Google_Service_Oauth2;

class AuthController extends BaseController {
    public function googleCallback() {
        if (isset($_GET['code'])) {
            try {
                // Verify OAuth state token to prevent Login CSRF
                if (empty($_GET['state']) || empty($_SESSION['oauth_state']) || !hash_equals($_SESSION['oauth_state'], $_GET['state'])) {
                    error_log('[Gadget Clinic] OAuth State validation failed.');
                    $_SESSION['error_message'] = "Invalid authentication state. Please try logging in again.";
                    $this->redirect('/');
                }
                unset($_SESSION['oauth_state']);

                $token = $this->client->fetchAccessTokenWithAuthCode($_GET['code']);

                if (isset($token['error']) || empty($token['access_token'])) {
                    error_log('[Gadget Clinic] OAuth error: ' . ($token['error_description'] ?? $token['error'] ?? 'Token error'));
                    $_SESSION['error_message'] = "Google authentication was cancelled or failed. Please try again.";
                    $this->redirect('/');
                }

                $this->client->setAccessToken($token['access_token']);

                $google_oauth = new Google_Service_Oauth2($this->client);
                $google_account_info = $google_oauth->userinfo->get();

                $google_id = $google_account_info->id;
                $name = $google_account_info->name;
                $email = $google_account_info->email;

                $userModel = new User();
                $user = $userModel->findByEmail($email);

                $role = 'client';
                if ($user) {
                    $_SESSION['user_id'] = $user['id'];
                    $role = $user['role'] ?? 'client';
                } else {
                    $_SESSION['user_id'] = $userModel->create($google_id, $name, $email);
                }

                session_regenerate_id(true);
                $this->rotateCsrfToken();

                if ($role === 'admin') {
                    $this->redirect('/admin');
                } else {
                    $this->redirect('/dashboard');
                }
            } catch (\Exception $e) {
                error_log('[Gadget Clinic] OAuth Exception: ' . $e->getMessage());
                $_SESSION['error_message'] = "Authentication error encountered. Please try again.";
                $this->redirect('/');
            }
        } else {
            $this->redirect('/');
        }
    }
}
