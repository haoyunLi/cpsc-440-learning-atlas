m <- 250000L
threshold <- .05/m
print(threshold)
stopifnot(abs(m*threshold-.05)<1e-14)
