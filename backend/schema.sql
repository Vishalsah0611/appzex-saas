CREATE TABLE agencies(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(150) NOT NULL,owner_email VARCHAR(190),phone VARCHAR(40),
 status ENUM('active','suspended') DEFAULT 'active',plan VARCHAR(30) DEFAULT 'trial',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(name),INDEX(status));
CREATE TABLE clients(id INT AUTO_INCREMENT PRIMARY KEY,agency_id INT NOT NULL,company VARCHAR(150) NOT NULL,contact_name VARCHAR(120),email VARCHAR(190),phone VARCHAR(40),notes TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(agency_id),FOREIGN KEY(agency_id) REFERENCES agencies(id));
CREATE TABLE users(id INT AUTO_INCREMENT PRIMARY KEY,email VARCHAR(190) NOT NULL UNIQUE,password_hash VARCHAR(100) NOT NULL,name VARCHAR(120) NOT NULL,
 role ENUM('super_admin','agency_admin','agency_member','client') NOT NULL,agency_id INT NULL,client_id INT NULL,active TINYINT DEFAULT 1,
 FOREIGN KEY(agency_id) REFERENCES agencies(id),FOREIGN KEY(client_id) REFERENCES clients(id));
CREATE TABLE projects(id INT AUTO_INCREMENT PRIMARY KEY,agency_id INT NOT NULL,client_id INT NOT NULL,name VARCHAR(150) NOT NULL,description TEXT,
 status ENUM('active','on_hold','completed') DEFAULT 'active',priority ENUM('low','medium','high') DEFAULT 'medium',start_date DATE,due_date DATE,manager_id INT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(agency_id,client_id),FOREIGN KEY(agency_id) REFERENCES agencies(id),FOREIGN KEY(client_id) REFERENCES clients(id));
CREATE TABLE tasks(id INT AUTO_INCREMENT PRIMARY KEY,agency_id INT NOT NULL,project_id INT NOT NULL,title VARCHAR(200) NOT NULL,description TEXT,assignee_id INT NULL,
 status ENUM('todo','in_progress','done') DEFAULT 'todo',priority ENUM('low','medium','high') DEFAULT 'medium',due_date DATE,
 INDEX(agency_id,project_id),FOREIGN KEY(project_id) REFERENCES projects(id));
CREATE TABLE feedback(id INT AUTO_INCREMENT PRIMARY KEY,agency_id INT NOT NULL,project_id INT NOT NULL,submitted_by INT NOT NULL,title VARCHAR(200) NOT NULL,description TEXT,
 status ENUM('open','in_review','in_progress','resolved','declined') DEFAULT 'open',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX(agency_id,project_id),FOREIGN KEY(project_id) REFERENCES projects(id));
CREATE TABLE files(id INT AUTO_INCREMENT PRIMARY KEY,agency_id INT NOT NULL,project_id INT NOT NULL,uploaded_by INT NOT NULL,original_name VARCHAR(255),stored_name VARCHAR(80) NOT NULL,
 shared_with_client TINYINT DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(agency_id,project_id),FOREIGN KEY(project_id) REFERENCES projects(id));
CREATE TABLE activity_logs(id BIGINT AUTO_INCREMENT PRIMARY KEY,agency_id INT NULL,actor_id INT NULL,event_type VARCHAR(60) NOT NULL,entity_type VARCHAR(30),entity_id INT,
 visible_to_client TINYINT DEFAULT 0,meta JSON,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(agency_id,entity_type,entity_id),INDEX(created_at));
