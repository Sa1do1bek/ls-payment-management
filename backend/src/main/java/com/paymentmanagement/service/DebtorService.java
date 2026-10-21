package com.paymentmanagement.service;

import com.paymentmanagement.dto.response.DebtorResponse;
import com.paymentmanagement.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class DebtorService {

    private final StudentRepository students;

    public DebtorService(StudentRepository students) {
        this.students = students;
    }

    public List<DebtorResponse> list(YearMonth month) {
        LocalDate startDate = month.atDay(1);
        LocalDate endDate = month.plusMonths(1).atDay(1);
        List<DebtorResponse> debtors = new ArrayList<>();
        for (StudentRepository.MonthlyTotal total : students.findMonthlyTotals(startDate, endDate)) {
            BigInteger paid = total.getPaidAmount().toBigIntegerExact();
            BigInteger remaining = BigInteger.valueOf(total.getMonthlyFee()).subtract(paid);
            if (remaining.signum() > 0) {
                debtors.add(new DebtorResponse(total.getStudentId(), total.getName(), total.getPhone(),
                        total.getGroupName(), total.getMonthlyFee(), paid, remaining.longValueExact()));
            }
        }
        return debtors;
    }
}
