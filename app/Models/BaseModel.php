<?php
namespace App\Models;

class BaseModel {
    protected $db;

    public function __construct() {
        global $pdo;
        $this->db = $pdo;
    }
}
