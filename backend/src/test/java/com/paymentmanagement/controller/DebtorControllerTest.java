package com.paymentmanagement.controller;

import com.paymentmanagement.dto.response.DebtorResponse;
import com.paymentmanagement.service.DebtorService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigInteger;
import java.time.YearMonth;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DebtorController.class)
class DebtorControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private DebtorService service;

    @Test
    void bothRoutesReturnIdenticalNumericJson() throws Exception {
        when(service.list(YearMonth.of(2026, 10))).thenReturn(List.of(
                new DebtorResponse(7L, "Ali Valiyev", "+998901234567", "English B2",
                        800000L, BigInteger.valueOf(300000), 500000L)));

        String primary = mvc.perform(get("/api/debtors?month=2026-10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].studentId").value(7))
                .andExpect(jsonPath("$[0].name").value("Ali Valiyev"))
                .andExpect(jsonPath("$[0].phone").value("+998901234567"))
                .andExpect(jsonPath("$[0].groupName").value("English B2"))
                .andExpect(jsonPath("$[0].monthlyFee").value(800000))
                .andExpect(jsonPath("$[0].paidAmount").value(300000))
                .andExpect(jsonPath("$[0].debt").value(500000))
                .andReturn().getResponse().getContentAsString();
        String compatibility = mvc.perform(get("/debtors?month=2026-10"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertEquals(primary, compatibility);
    }

    @Test
    void noDebtorsReturnsEmptyArrayOnBothRoutes() throws Exception {
        when(service.list(YearMonth.of(2026, 10))).thenReturn(List.of());

        mvc.perform(get("/api/debtors?month=2026-10"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/debtors?month=2026-10"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void missingMonthReturnsSameErrorOnBothRoutes() throws Exception {
        String primary = mvc.perform(get("/api/debtors"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("month must use YYYY-MM format"))
                .andExpect(jsonPath("$.path").value("/api/debtors"))
                .andReturn().getResponse().getContentAsString();
        String compatibility = mvc.perform(get("/debtors"))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();

        assertEquals(primary, compatibility);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "2026-1", "2026-13", "2026-00", "2026/10", "abc", "0000-01", "10000-01"})
    void invalidMonthReturnsSameErrorOnBothRoutes(String month) throws Exception {
        String primary = mvc.perform(get("/api/debtors").param("month", month))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("month must use YYYY-MM format"))
                .andReturn().getResponse().getContentAsString();
        String compatibility = mvc.perform(get("/debtors").param("month", month))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();

        assertEquals(primary, compatibility);
    }

    @Test
    void validJanuaryAndDecemberAreAccepted() throws Exception {
        when(service.list(YearMonth.of(2026, 1))).thenReturn(List.of());
        when(service.list(YearMonth.of(2026, 12))).thenReturn(List.of());

        mvc.perform(get("/api/debtors?month=2026-01")).andExpect(status().isOk());
        mvc.perform(get("/debtors?month=2026-12")).andExpect(status().isOk());
    }
}
