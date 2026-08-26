package com.busstop.predictor.repository;

import com.busstop.predictor.model.HistoricalData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface HistoricalDataRepository extends JpaRepository<HistoricalData, Long> {
    List<HistoricalData> findByBusStopId(Long busStopId);
}
