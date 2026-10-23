<?php
namespace App\Models;

class User extends BaseModel {
    public function findById($id) {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public function findByEmail($email) {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        return $stmt->fetch();
    }

    public function create($google_id, $name, $email) {
        $stmt = $this->db->prepare("INSERT INTO users (google_id, name, email) VALUES (?, ?, ?)");
        $stmt->execute([$google_id, $name, $email]);
        return $this->db->lastInsertId();
    }

    public function updatePhone($id, $phone) {
        $stmt = $this->db->prepare("UPDATE users SET phone = ? WHERE id = ?");
        return $stmt->execute([$phone, $id]);
    }
}
