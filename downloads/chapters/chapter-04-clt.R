# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 04, section: clt
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# A possible sequence from independent Bernoulli(.5) observations.
y <- c(0,1,1,1,0)
n <- seq_along(y)
running_mean <- cumsum(y)/n
error <- abs(running_mean-.5)
print(data.frame(n=n,observation=y,running_mean=running_mean,
                 absolute_error=error))
# The second mean equals .5, but the third is farther away.
stopifnot(error[3] > error[2])
