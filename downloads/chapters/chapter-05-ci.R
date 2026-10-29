# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 05, section: ci
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Exact z interval for an independent normal sample with known sigma.
ybar <- 54; sigma <- 10; n <- 25
print(ybar + c(-1, 1) * qnorm(.975) * sigma / sqrt(n))

# Planning uses the assumed population SD, not a future observed sample SD.
planning_sd <- .75; target_width <- .50; level <- .99
critical_z <- qnorm((1 + level) / 2)
n_continuous <- (critical_z * planning_sd / (target_width / 2))^2
n_required <- ceiling(n_continuous)
width_at <- function(n) 2 * critical_z * planning_sd / sqrt(n)
print(c(n_continuous = n_continuous, n_required = n_required,
        width_at_n = width_at(n_required),
        width_at_previous_n = width_at(n_required - 1)))
stopifnot(width_at(n_required) <= target_width,
          width_at(n_required - 1) > target_width)
