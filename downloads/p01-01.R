# Count independent units and subsamples
boxes <- 12
plants_per_box <- 10
c(independent_units = boxes, observations = boxes * plants_per_box,
  replicates_per_temperature = boxes / 3)
