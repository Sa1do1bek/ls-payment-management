package com.paymentmanagement.repository;

import com.paymentmanagement.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    boolean existsByStudent_Id(Long studentId);

    List<Payment> findByStudent_IdOrderByPaymentDateDescIdDesc(Long studentId);
}
