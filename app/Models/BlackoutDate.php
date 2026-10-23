<?php
namespace App\Models;

class BlackoutDate extends BaseModel {
    public function getAll() {
        $stmt = $this->db->query("SELECT * FROM blackout_dates ORDER BY blackout_date ASC");
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function getUpcoming() {
        $stmt = $this->db->query("SELECT * FROM blackout_dates WHERE blackout_date >= CURRENT_DATE() ORDER BY blackout_date ASC");
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function add($date, $reason) {
        $stmt = $this->db->prepare("INSERT INTO blackout_dates (blackout_date, reason) VALUES (?, ?)");
        return $stmt->execute([$date, $reason]);
    }

    public function delete($id) {
        $stmt = $this->db->prepare("DELETE FROM blackout_dates WHERE id = ?");
        return $stmt->execute([$id]);
    }

    public function isBlackout($date) {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM blackout_dates WHERE blackout_date = ?");
        $stmt->execute([$date]);
        return (int)$stmt->fetchColumn() > 0;
    }
}
