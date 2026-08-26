package com.busstop.predictor.repository;

import com.busstop.predictor.model.Prediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PredictionRepository extends JpaRepository<Prediction, Long> {
    List<Prediction> findByBusStopIdOrderByCreatedAtDesc(Long busStopId);
}
