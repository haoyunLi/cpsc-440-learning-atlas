# Original fitted cell summaries, in Low/High order.
cell_mean <- rbind(V1=c(Low=8,High=20),V2=c(Low=13,High=17))
cell_n <- rbind(V1=c(Low=8,High=2),V2=c(Low=2,High=8))
# Use the same prespecified target composition for both varieties.
w <- c(Low=.75,High=.25)
target_mean <- as.vector(cell_mean %*% w)
raw_mean <- rowSums(cell_mean*cell_n)/rowSums(cell_n)
equal_mean <- rowMeans(cell_mean)
simple_effect <- cell_mean["V2",]-cell_mean["V1",]
answer <- target_mean[2]-target_mean[1]
print(data.frame(variety=rownames(cell_mean),raw=raw_mean,
                 equal=equal_mean,target=target_mean))
print(c(target_difference=answer,
        weighted_simple_effect=sum(w*simple_effect),
        raw_difference=diff(raw_mean),equal_difference=diff(equal_mean)))
stopifnot(abs(answer-3)<1e-12,
          abs(answer-sum(w*simple_effect))<1e-12)
# These are point estimates; uncertainty requires the fitted model covariance.
