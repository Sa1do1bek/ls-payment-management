package com.paymentmanagement.repository;

import com.paymentmanagement.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface StudentRepository extends JpaRepository<Student, Long> {

    interface MonthlyTotal {
        Long getStudentId();
        String getName();
        String getPhone();
        String getGroupName();
        Long getMonthlyFee();
        BigDecimal getPaidAmount();
    }

    @Query(value = """
            SELECT s.id AS "studentId", s.name AS "name", s.phone AS "phone",
                   s.group_name AS "groupName", s.monthly_fee AS "monthlyFee",
                   COALESCE(SUM(p.amount), 0) AS "paidAmount"
            FROM students s
            LEFT JOIN payments p ON p.student_id = s.id
                AND p.payment_date >= :startDate AND p.payment_date < :endDate
            GROUP BY s.id, s.name, s.phone, s.group_name, s.monthly_fee
            ORDER BY s.id ASC
            """, nativeQuery = true)
    List<MonthlyTotal> findMonthlyTotals(@Param("startDate") LocalDate startDate,
                                         @Param("endDate") LocalDate endDate);
}
