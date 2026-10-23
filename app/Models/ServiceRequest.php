<?php
namespace App\Models;

class ServiceRequest extends BaseModel {
    public function getByUserId($user_id) {
        $stmt = $this->db->prepare("SELECT * FROM service_requests WHERE user_id = ? ORDER BY request_datetime DESC");
        $stmt->execute([$user_id]);
        return $stmt->fetchAll();
    }

    public function getAllWithUsers() {
        return $this->db->query("
            SELECT a.*, u.name, u.email, COALESCE(a.phone, u.phone) AS user_phone 
            FROM service_requests a 
            JOIN users u ON a.user_id = u.id 
            ORDER BY a.request_datetime DESC
        ")->fetchAll();
    }

    public function getSummaryStats() {
        return $this->db->query("SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN status = 'for_pickup' THEN 1 ELSE 0 END) as for_pickup,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
            FROM service_requests")->fetch();
    }
    
    public function hasActiveBooking($user_id, $datetime) {
        $stmt = $this->db->prepare("SELECT id FROM service_requests WHERE user_id = ? AND request_datetime = ? AND status != 'cancelled'");
        $stmt->execute([$user_id, $datetime]);
        return $stmt->fetch() !== false;
    }
    
    public function isSlotBooked($datetime, $service, $exclude_id = 0) {
        $sql = "SELECT id FROM service_requests WHERE request_datetime = ? AND service_type = ? AND status != 'cancelled'";
        $params = [$datetime, $service];
        if ($exclude_id > 0) {
            $sql .= " AND id != ?";
            $params[] = $exclude_id;
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetch() !== false;
    }

    public function isSlotBookedForUpdate($datetime, $service, $exclude_id = 0) {
        $sql = "SELECT id FROM service_requests WHERE request_datetime = ? AND service_type = ? AND status != 'cancelled'";
        $params = [$datetime, $service];
        if ($exclude_id > 0) {
            $sql .= " AND id != ?";
            $params[] = $exclude_id;
        }
        $sql .= " FOR UPDATE";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetch() !== false;
    }

    public function create($user_id, $datetime, $service, $phone, $document_path) {
        $stmt = $this->db->prepare("INSERT INTO service_requests (user_id, request_datetime, service_type, phone, document_path) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$user_id, $datetime, $service, $phone, $document_path]);
        return $this->db->lastInsertId();
    }

    public function cancel($id, $user_id) {
        $stmt = $this->db->prepare("UPDATE service_requests SET status = 'cancelled' WHERE id = ? AND user_id = ?");
        return $stmt->execute([$id, $user_id]);
    }

    public function findByIdAndUser($id, $user_id) {
        $stmt = $this->db->prepare("SELECT * FROM service_requests WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $user_id]);
        return $stmt->fetch();
    }

    public function getTicketInfo($id, $user_id) {
        $stmt = $this->db->prepare("
            SELECT a.*, u.name, u.email, COALESCE(a.phone, u.phone) AS customer_phone 
            FROM service_requests a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.id = ? AND (a.user_id = ? OR (SELECT role FROM users WHERE id = ?) = 'admin')
        ");
        $stmt->execute([$id, $user_id, $user_id]);
        return $stmt->fetch();
    }

    public function findWithUser($id) {
        $stmt = $this->db->prepare("
            SELECT a.*, u.name, u.email, COALESCE(a.phone, u.phone) AS recipient_phone 
            FROM service_requests a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.id = ?
        ");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public function updateQuote($id, $amount, $description, $status = 'pending') {
        $stmt = $this->db->prepare("UPDATE service_requests SET quote_amount = ?, quote_description = ?, quote_status = ? WHERE id = ?");
        return $stmt->execute([$amount, $description, $status, $id]);
    }

    public function updateQuoteStatus($id, $user_id, $status) {
        $stmt = $this->db->prepare("UPDATE service_requests SET quote_status = ? WHERE id = ? AND user_id = ?");
        return $stmt->execute([$status, $id, $user_id]);
    }

    public function updateStatus($id, $status) {
        $stmt = $this->db->prepare("UPDATE service_requests SET status = ? WHERE id = ?");
        return $stmt->execute([$status, $id]);
    }

    public function reschedule($id, $new_datetime) {
        $stmt = $this->db->prepare("UPDATE service_requests SET request_datetime = ? WHERE id = ?");
        return $stmt->execute([$new_datetime, $id]);
    }

    public function getSlotsByDate($date) {
        $stmt = $this->db->prepare("
            SELECT id, request_datetime, service_type, user_id 
            FROM service_requests 
            WHERE DATE(request_datetime) = ? AND status != 'cancelled'
        ");
        $stmt->execute([$date]);
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function getMaxId() {
        return (int) $this->db->query("SELECT MAX(id) FROM service_requests")->fetchColumn();
    }
}
