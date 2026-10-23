<?php
namespace App\Controllers;

use App\Models\User;

class HomeController extends BaseController {
    public function index() {
        if (isset($_SESSION['user_id'])) {
            $userModel = new User();
            $user = $userModel->findById($_SESSION['user_id']);
            
            if ($user) {
                if ($user['role'] === 'admin') {
                    $this->redirect('/admin');
                } else {
                    $this->redirect('/dashboard');
                }
            }
        }
        
        $state = bin2hex(random_bytes(16));
        $_SESSION['oauth_state'] = $state;
        $this->client->setState($state);

        $loginUrl = $this->client->createAuthUrl();

        $error_message = "";
        if (isset($_SESSION['error_message'])) {
            $error_message = $_SESSION['error_message'];
            unset($_SESSION['error_message']);
        }

        $this->render('index.twig', [
            'login_url' => $loginUrl,
            'error_message' => $error_message
        ]);
    }
}
