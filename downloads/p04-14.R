# Fixed population SD and fixed observations per sample.
sigma <- 1
n <- 25
B <- c(100,1600)
se_one_mean <- rep(sigma/sqrt(n),length(B))
se_mean_of_means <- sigma/sqrt(n*B)
print(data.frame(n=n,B=B,raw_count=n*B,SE_one_mean=se_one_mean,
                 SE_mean_of_means=se_mean_of_means))
stopifnot(all(se_one_mean==.2),abs(se_mean_of_means[2]-.005)<1e-12)
# The first choice describes the per-sample mean, not the mean of all samples.
answer <- 0L
print(answer)
