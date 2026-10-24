<?php
namespace App\Controllers;

use App\Models\User;
use App\Models\ServiceRequest;

class DashboardController extends BaseController {
    public function index() {
        $user_id = $this->requireAuth();

        $success_message = "";
        if (isset($_SESSION['success_message'])) {
            $success_message = $_SESSION['success_message'];
            unset($_SESSION['success_message']);
        }

        $error_message = "";
        if (isset($_SESSION['error_message'])) {
            $error_message = $_SESSION['error_message'];
            unset($_SESSION['error_message']);
        }

        $userModel = new User();
        $user = $userModel->findById($user_id);

        if (!$user) {
            session_destroy();
            $this->redirect('/');
        }

        $name_parts = explode(' ', trim($user['name']));
        $initials = strtoupper(substr($name_parts[0], 0, 1));
        if (count($name_parts) > 1) {
            $initials .= strtoupper(substr(end($name_parts), 0, 1));
        }

        $requestModel = new ServiceRequest();
        $requests = $requestModel->getByUserId($user_id);

        $total_count = count($requests);
        $pending_count = 0;
        $confirmed_count = 0;
        $in_progress_count = 0;
        $for_pickup_count = 0;
        $completed_count = 0;
        $cancelled_count = 0;
        
        foreach($requests as $r) {
            match($r['status']) {
                'pending'     => $pending_count++,
                'confirmed'   => $confirmed_count++,
                'in_progress' => $in_progress_count++,
                'for_pickup'  => $for_pickup_count++,
                'completed'   => $completed_count++,
                'cancelled'   => $cancelled_count++,
                default       => null,
            };
        }

        $scheduled_count = $pending_count + $confirmed_count;

        $this->render('dashboard.twig', [
            'user' => $user,
            'initials' => $initials,
            'success_message' => $success_message,
            'error_message' => $error_message,
            'all_requests' => $requests,
            'total_count' => $total_count,
            'scheduled_count' => $scheduled_count,
            'pending_count' => $pending_count,
            'confirmed_count' => $confirmed_count,
            'in_progress_count' => $in_progress_count,
            'for_pickup_count' => $for_pickup_count,
            'completed_count' => $completed_count,
            'cancelled_count' => $cancelled_count
        ]);
    }
}
