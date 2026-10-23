<?php
namespace App\Controllers;

use App\Models\User;
use App\Models\ServiceRequest;

class AdminController extends BaseController {
    public function index() {
        $user = $this->requireAdmin();

        $name_parts = explode(' ', trim($user['name']));
        $initials = strtoupper(substr($name_parts[0], 0, 1));
        if (count($name_parts) > 1) {
            $initials .= strtoupper(substr(end($name_parts), 0, 1));
        }

        $requestModel = new ServiceRequest();
        $all_requests = $requestModel->getAllWithUsers();
        $stats = $requestModel->getSummaryStats();

        $success_message = "";
        if (isset($_SESSION['admin_success_message'])) {
            $success_message = $_SESSION['admin_success_message'];
            unset($_SESSION['admin_success_message']);
        }

        $this->render('admin.twig', [
            'user' => $user,
            'initials' => $initials,
            'all_requests' => $all_requests,
            'count_all' => $stats['total'],
            'count_pending' => $stats['pending'],
            'count_confirmed' => $stats['confirmed'],
            'count_in_progress' => $stats['in_progress'],
            'count_for_pickup' => $stats['for_pickup'],
            'count_completed' => $stats['completed'],
            'count_cancelled' => $stats['cancelled'],
            'success_message' => $success_message
        ]);
    }
}
