# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 04, section: clt
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Independent teaching simulation: each column is one sample of n observations.
set.seed(440)
settings <- data.frame(n=c(25,25,100), B=c(100,1600,100))
results <- lapply(seq_len(nrow(settings)),function(i) {
  n <- settings$n[i]
  B <- settings$B[i]
  raw <- matrix(rexp(n*B,rate=1),nrow=n,ncol=B)
  sample_means <- colMeans(raw)
  data.frame(n=n,B=B,raw_count=n*B,mean_count=length(sample_means),
             population_SD=1,theoretical_SE=1/sqrt(n),
             simulated_SD_of_means=sd(sample_means),
             mean_of_means=mean(sample_means))
})
result <- do.call(rbind,results)
print(result)
# More repetitions at fixed n do not change the distribution's theoretical SE.
stopifnot(result$theoretical_SE[1]==result$theoretical_SE[2],
          result$theoretical_SE[3]==result$theoretical_SE[1]/2,
          all(result$mean_count==result$B))
# One new group produces one new mean, not n means.
one_sample <- rexp(25,rate=1)
print(one_sample)
print(c(sample_size=length(one_sample),sum=sum(one_sample),
        one_mean=sum(one_sample)/length(one_sample)))
