package com.paymentmanagement.controller;

import com.paymentmanagement.dto.response.DebtorResponse;
import com.paymentmanagement.exception.InvalidMonthException;
import com.paymentmanagement.service.DebtorService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.time.temporal.ChronoField;
import java.util.List;

@RestController
public class DebtorController {

    private static final DateTimeFormatter MONTH_FORMAT = new DateTimeFormatterBuilder()
            .appendValue(ChronoField.YEAR, 4)
            .appendLiteral('-')
            .appendValue(ChronoField.MONTH_OF_YEAR, 2)
            .toFormatter()
            .withResolverStyle(ResolverStyle.STRICT);

    private final DebtorService service;

    public DebtorController(DebtorService service) {
        this.service = service;
    }

    @GetMapping({"/api/debtors", "/debtors"})
    public List<DebtorResponse> list(@RequestParam(required = false) String month) {
        if (month == null) {
            throw new InvalidMonthException();
        }
        try {
            YearMonth parsed = YearMonth.parse(month, MONTH_FORMAT);
            if (parsed.getYear() == 0) {
                throw new InvalidMonthException();
            }
            return service.list(parsed);
        } catch (DateTimeParseException exception) {
            throw new InvalidMonthException();
        }
    }
}
