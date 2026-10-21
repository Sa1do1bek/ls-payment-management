package com.paymentmanagement.controller;

import com.paymentmanagement.dto.request.StudentRequest;
import com.paymentmanagement.dto.response.StudentResponse;
import com.paymentmanagement.exception.StudentDeletionConflictException;
import com.paymentmanagement.exception.StudentNotFoundException;
import com.paymentmanagement.service.StudentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StudentController.class)
class StudentControllerTest {

    private static final String VALID_JSON = """
            {"name":"Ali Valiyev","phone":"+998901234567","groupName":"English B2","monthlyFee":800000}
            """;

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private StudentService service;

    private final StudentResponse response =
            new StudentResponse(7L, "Ali Valiyev", "+998901234567", "English B2", 800000L);

    @Test
    void createReturns201AndLocation() throws Exception {
        when(service.create(any(StudentRequest.class))).thenReturn(response);

        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON).content(VALID_JSON))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", endsWith("/api/students/7")))
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.monthlyFee").value(800000));
    }

    @Test
    void emptyListReturnsArray() throws Exception {
        when(service.list()).thenReturn(List.of());

        mvc.perform(get("/api/students"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void listReturnsStudents() throws Exception {
        when(service.list()).thenReturn(List.of(response));

        mvc.perform(get("/api/students"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(7));
    }

    @Test
    void getReturnsStudent() throws Exception {
        when(service.get(7L)).thenReturn(response);

        mvc.perform(get("/api/students/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupName").value("English B2"));
    }

    @Test
    void missingStudentReturns404() throws Exception {
        when(service.get(999L)).thenThrow(new StudentNotFoundException(999L));

        mvc.perform(get("/api/students/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Student with ID 999 was not found"))
                .andExpect(jsonPath("$.path").value("/api/students/999"));
    }

    @Test
    void invalidBodyReturns400WithFieldName() throws Exception {
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":" ","phone":"+998901234567","groupName":"English B2","monthlyFee":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("name")))
                .andExpect(jsonPath("$.message", containsString("monthlyFee")));
    }

    @Test
    void missingFieldsOnPutReturn400() throws Exception {
        mvc.perform(put("/api/students/7").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Ali\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("phone")))
                .andExpect(jsonPath("$.message", containsString("monthlyFee")));
    }

    @Test
    void fractionalFeeReturns400() throws Exception {
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_JSON.replace("800000", "800000.5")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void malformedJsonReturns400() throws Exception {
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void invalidIdReturns400() throws Exception {
        mvc.perform(get("/api/students/0"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/students/not-a-number"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateReturns200() throws Exception {
        when(service.update(any(Long.class), any(StudentRequest.class))).thenReturn(response);

        mvc.perform(put("/api/students/7").contentType(MediaType.APPLICATION_JSON).content(VALID_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(7));
    }

    @Test
    void deleteReturns204() throws Exception {
        mvc.perform(delete("/api/students/7"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
    }

    @Test
    void deleteConflictReturns409() throws Exception {
        doThrow(new StudentDeletionConflictException(7L)).when(service).delete(7L);

        mvc.perform(delete("/api/students/7"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("payment history")));
    }
}
