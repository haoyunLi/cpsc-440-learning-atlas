# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 11, section: correlation-bias
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original Monte Carlo study; the seed fixes this software illustration.
set.seed(44011)
repetitions <- 5000
simulate_r <- function(n, rho, repetitions) {
  stopifnot(n >= 3, abs(rho) < 1)
  replicate(repetitions, {
    x <- rnorm(n)
    independent_z <- rnorm(n)
    y <- rho*x+sqrt(1-rho^2)*independent_z
    cor(x, y)
  })
}
settings <- data.frame(n=c(3,50,3), rho=c(.8,.8,0))
r_samples <- lapply(seq_len(nrow(settings)), function(i) {
  simulate_r(settings$n[i], settings$rho[i], repetitions)
})
mean_r <- vapply(r_samples, mean, numeric(1))
sampling_sd <- vapply(r_samples, sd, numeric(1))
bias_estimate <- mean_r-settings$rho
mcse <- sampling_sd/sqrt(repetitions)
simulation_summary <- data.frame(settings, repetitions=repetitions,
  mean_r=mean_r, sampling_SD=sampling_sd, bias_estimate=bias_estimate,
  MCSE=mcse, MC_lower=bias_estimate-qnorm(.975)*mcse,
  MC_upper=bias_estimate+qnorm(.975)*mcse)
simulation_summary
# These histograms describe repeated estimates, not the raw X or Y data.
par(mfrow=c(1,3))
for (i in seq_len(nrow(settings))) {
  hist(r_samples[[i]], breaks=30, xlim=c(-1,1), xlab="Sample r",
       main=paste("n =",settings$n[i],"rho =",settings$rho[i]))
  abline(v=settings$rho[i], col="firebrick", lwd=2)
}
par(mfrow=c(1,1))
