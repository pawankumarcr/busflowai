package com.busstop.predictor.repository;

import com.busstop.predictor.model.Feedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FeedbackRepository extends JpaRepository<Feedback, Long> {
    List<Feedback> findByPredictionBusStopId(Long busStopId);
}
