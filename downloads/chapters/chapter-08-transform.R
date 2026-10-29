# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 08, section: transform
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original observations; retain the shift used by the transformation.
y <- c(.625, 3.625, 8.625, 15.625, 24.625)
shift <- 3/8
transformed <- sqrt(y+shift)
n <- length(y)
naive_back_transform <- mean(transformed)^2-shift
recovered_sample_mean <- mean(transformed)^2 +
  (n-1)/n*var(transformed)-shift
data.frame(y=y, transformed=transformed)
c(mean_transformed=mean(transformed), variance_transformed=var(transformed),
  back_transformed_center=naive_back_transform,
  recovered_sample_mean=recovered_sample_mean, observed_sample_mean=mean(y))
