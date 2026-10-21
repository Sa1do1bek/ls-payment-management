package com.paymentmanagement.service;

import com.paymentmanagement.dto.response.DebtorResponse;
import com.paymentmanagement.repository.StudentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DebtorServiceTest {

    @Mock
    private StudentRepository students;

    @InjectMocks
    private DebtorService service;

    @Test
    void unpaidStudentHasFullFeeAsDebt() {
        when(students.findMonthlyTotals(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 11, 1)))
                .thenReturn(List.of(row(7, 800000, "0")));

        assertEquals(List.of(new DebtorResponse(7L, "Student 7", "+998901234567", "English B2",
                800000L, BigInteger.ZERO, 800000L)), service.list(YearMonth.of(2026, 10)));
    }

    @Test
    void partialPaymentsAreSubtractedFromFee() {
        when(students.findMonthlyTotals(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 11, 1)))
                .thenReturn(List.of(row(7, 800000, "500000")));

        DebtorResponse debtor = service.list(YearMonth.of(2026, 10)).getFirst();
        assertEquals(300000L, debtor.debt());
        assertEquals(new BigInteger("500000"), debtor.paidAmount());
    }

    @Test
    void fullyPaidAndOverpaidStudentsAreExcluded() {
        when(students.findMonthlyTotals(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 11, 1)))
                .thenReturn(List.of(row(7, 800000, "800000"), row(8, 800000, "1000000")));

        assertEquals(List.of(), service.list(YearMonth.of(2026, 10)));
    }

    @Test
    void differentStudentsRemainSeparateAndOrdered() {
        when(students.findMonthlyTotals(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 11, 1)))
                .thenReturn(List.of(row(3, 600000, "0"), row(7, 800000, "300000"),
                        row(9, 700000, "700000")));

        List<DebtorResponse> debtors = service.list(YearMonth.of(2026, 10));

        assertEquals(List.of(3L, 7L), debtors.stream().map(DebtorResponse::studentId).toList());
        assertEquals(List.of(600000L, 500000L), debtors.stream().map(DebtorResponse::debt).toList());
    }

    @Test
    void noStudentsOrNoDebtorsReturnsEmptyArray() {
        when(students.findMonthlyTotals(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 11, 1)))
                .thenReturn(List.of());

        assertEquals(List.of(), service.list(YearMonth.of(2026, 10)));
    }

    @Test
    void dateRangeUsesExclusiveNextMonthForLeapYearAndYearTransition() {
        when(students.findMonthlyTotals(LocalDate.of(2024, 2, 1), LocalDate.of(2024, 3, 1)))
                .thenReturn(List.of());
        when(students.findMonthlyTotals(LocalDate.of(2026, 12, 1), LocalDate.of(2027, 1, 1)))
                .thenReturn(List.of());

        service.list(YearMonth.of(2024, 2));
        service.list(YearMonth.of(2026, 12));

        verify(students).findMonthlyTotals(LocalDate.of(2024, 2, 1), LocalDate.of(2024, 3, 1));
        verify(students).findMonthlyTotals(LocalDate.of(2026, 12, 1), LocalDate.of(2027, 1, 1));
    }

    @Test
    void aggregateAboveLongMaximumKeepsExactPaidAmountAndNoNegativeDebt() {
        when(students.findMonthlyTotals(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 11, 1)))
                .thenReturn(List.of(row(7, 800000, "9223372036854775808")));

        assertEquals(List.of(), service.list(YearMonth.of(2026, 10)));
    }

    private StudentRepository.MonthlyTotal row(long id, long fee, String paid) {
        return new StudentRepository.MonthlyTotal() {
            public Long getStudentId() { return id; }
            public String getName() { return "Student " + id; }
            public String getPhone() { return "+998901234567"; }
            public String getGroupName() { return "English B2"; }
            public Long getMonthlyFee() { return fee; }
            public BigDecimal getPaidAmount() { return new BigDecimal(paid); }
        };
    }
}
